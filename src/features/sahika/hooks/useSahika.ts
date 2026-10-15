import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioModule } from 'expo-audio';
import { useConversation, type HookOptions } from '@elevenlabs/react-native';
import type { Conversation } from '@elevenlabs/client';
import type { ChatMessage, ChatMode, ChatScreenProps, ChatSession, ConnectionStatus } from '../components/ChatScreen';
import { config } from '../config';
import { loadHistory, saveHistory } from '../services/history';
import { getSessionOptions } from '../services/session';

type HookResult = Omit<ChatScreenProps, 'onShare' | 'onClinicAction'>;
type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };
type RuntimeSession = {
  key: string;
  localId: string;
  mode: ChatMode;
  cancelled: boolean;
  started: boolean;
  connected: boolean;
  prepared: boolean;
  raw: Conversation | null;
  abort: AbortController;
  ready: Deferred;
  closed: Deferred;
  events: Map<string, string>;
  optimistic: { id: string; text: string; timestamp: number }[];
  startTimer?: ReturnType<typeof setTimeout>;
  lifetimeTimer?: ReturnType<typeof setTimeout>;
  responseTimer?: ReturnType<typeof setTimeout>;
};

const INITIAL_SUGGESTIONS = ['Kedimin iştahı azaldı, neye dikkat etmeliyim?', 'Minik dostumun beslenmesini nasıl düzenleyebilirim?', 'Veteriner kontrolüne giderken neler hazırlamalıyım?'];
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
const cloneSession = (session: ChatSession): ChatSession => ({ ...session, messages: session.messages.map(message => ({ ...message })) });
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Bağlantıda bir sorun oluştu. Yeniden deneyebilirsin.';

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  // Cancellation may happen while another queued operation still owns the promise.
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

/** History is scoped to the selected local chat, including when the transport changes. */
function contextFor(messages: ChatMessage[]): string {
  let budget = 10_000;
  const rows: string[] = [];
  for (const message of messages.slice(-24).reverse()) {
    const text = message.text.slice(0, Math.min(2_000, budget));
    if (!text) break;
    rows.unshift(`${message.role === 'user' ? 'Kullanıcı' : 'Şahika'}: ${text}`);
    budget -= text.length;
    if (budget <= 0) break;
  }
  return rows.length ? `Bu cihazda kullanıcının açtığı AYNI sohbetin önceki mesajları aşağıdadır. Yalnızca bu sohbetin bağlamı olarak kullan. Başka sohbetlere veya hastalara ilişkin kalıcı bellek varsayma. Bu bağlam iletisine cevap verme; kullanıcının yeni sorusunu bekle.\n\n${rows.join('\n\n')}` : '';
}

export function useSahika(): HookResult {
  const sdk = useConversation();
  const sdkRef = useRef(sdk);
  useEffect(() => { sdkRef.current = sdk; }, [sdk]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [mode, setMode] = useState<ChatMode>('text');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micMuted, setMicMuted] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);
  const mounted = useRef(true);
  const hydrated = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sessionsRef = useRef<ChatSession[]>([]);
  const draftRef = useRef('');
  const localIdRef = useRef(id());
  const modeRef = useRef<ChatMode>('text');
  const intentRef = useRef(0);
  const runtimeRef = useRef<RuntimeSession | null>(null);
  const operationQueue = useRef(Promise.resolve());
  const persistenceQueue = useRef(Promise.resolve());
  const sending = useRef(false);
  const mutedRef = useRef(true);
  const invalidateIntent = useCallback(() => { ++intentRef.current; }, []);

  const cancelCurrent = useCallback(() => {
    const current = runtimeRef.current;
    if (!current) return;
    current.cancelled = true;
    current.abort.abort();
    // Release any operation awaiting the fire-and-forget SDK start before queuing teardown.
    current.ready.reject(new Error('Bağlantı isteği iptal edildi.'));
  }, []);

  const persist = useCallback((next: ChatSession[]) => {
    sessionsRef.current = next.map(cloneSession);
    if (mounted.current) setSessions(sessionsRef.current);
    if (!hydrated.current) return;
    const snapshot = next.map(cloneSession);
    persistenceQueue.current = persistenceQueue.current.catch(() => {}).then(() => saveHistory(snapshot)).catch(() => {
      if (mounted.current) setError('Sohbet bu cihazda kaydedilemedi. Mevcut görüşmene devam edebilirsin.');
    });
  }, []);

  const updateMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next.map(message => ({ ...message }));
    if (mounted.current) setMessages(messagesRef.current);
    if (!next.length) return;
    const now = Date.now();
    const firstUser = next.find(message => message.role === 'user');
    const record: ChatSession = { id: localIdRef.current, title: (firstUser?.text ?? 'Şahika ile sohbet').slice(0, 64), updatedAt: now, messages: messagesRef.current.map(message => ({ ...message })) };
    persist([record, ...sessionsRef.current.filter(session => session.id !== record.id)].slice(0, 50));
  }, [persist]);

  const valid = useCallback((session: RuntimeSession) => mounted.current && runtimeRef.current === session && !session.cancelled && session.localId === localIdRef.current, []);
  const clearTimers = useCallback((session: RuntimeSession) => {
    clearTimeout(session.startTimer);
    clearTimeout(session.lifetimeTimer);
    clearTimeout(session.responseTimer);
  }, []);

  const setMuted = useCallback((muted: boolean, session = runtimeRef.current) => {
    if (session?.mode === 'voice' && session.raw && session.connected && !session.cancelled) {
      session.raw.setMicMuted(muted);
    }
    mutedRef.current = muted;
    if (mounted.current) setMicMuted(muted);
  }, []);

  const endCurrent = useCallback(async () => {
    const session = runtimeRef.current;
    if (!session) return;
    session.cancelled = true;
    session.abort.abort();
    clearTimers(session);
    session.ready.reject(new Error('Görüşme sonlandırıldı.'));
    mutedRef.current = true;
    if (mounted.current) { setStatus('disconnecting'); setMicMuted(true); setIsSpeaking(false); setLoading(false); }
    if (!session.started) {
      session.closed.resolve();
    } else if (session.raw) {
      // The raw SDK method returns its teardown promise; the hook's wrapper returns void.
      await session.raw.endSession();
      session.closed.resolve();
    } else {
      // Provider owns the pending connection and will end it as soon as it is created.
      sdkRef.current.endSession();
      await session.closed.promise;
    }
    if (runtimeRef.current === session) {
      runtimeRef.current = null;
      if (mounted.current) setStatus('disconnected');
    }
    // Let the provider's pending-connection cleanup release its lock before another start.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }, [clearTimers]);

  const enqueue = useCallback((operation: () => Promise<void>) => {
    const result = operationQueue.current.catch(() => {}).then(operation);
    operationQueue.current = result.catch(() => {});
    return result;
  }, []);

  const waitForAnswer = useCallback((session: RuntimeSession) => {
    clearTimeout(session.responseTimer);
    if (mounted.current) setLoading(true);
    session.responseTimer = setTimeout(() => {
      if (!valid(session)) return;
      setLoading(false);
      setError('Yanıt biraz uzadı. Bağlantını kontrol edebilir veya görüşmeyi yeniden başlatabilirsin.');
    }, 90_000);
  }, [valid]);

  const connect = useCallback(async (requestedMode: ChatMode, intention: number) => {
    const previous = runtimeRef.current;
    if (previous && valid(previous) && previous.connected && previous.mode === requestedMode) return previous;
    await endCurrent();
    if (!mounted.current || intention !== intentRef.current || AppState.currentState === 'background') throw new Error('Bağlantı isteği iptal edildi.');
    if (requestedMode === 'voice') {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Sesli görüşme için iPhone Ayarlar bölümünden mikrofon izni vermelisin.');
      if (intention !== intentRef.current || !mounted.current) throw new Error('Bağlantı isteği iptal edildi.');
    }
    const session: RuntimeSession = { key: id(), localId: localIdRef.current, mode: requestedMode, cancelled: false, started: false, connected: false, prepared: false, raw: null, abort: new AbortController(), ready: deferred(), closed: deferred(), events: new Map(), optimistic: [] };
    runtimeRef.current = session;
    mutedRef.current = true;
    setStatus('connecting'); setError(null); setIsSpeaking(false); setMicMuted(true);
    try {
      const auth = await getSessionOptions(requestedMode, session.abort.signal);
      if (!valid(session) || intention !== intentRef.current) throw new Error('Bağlantı isteği iptal edildi.');
      const tools: NonNullable<HookOptions['clientTools']> = {};
      for (const [name, action] of Object.entries({ open_pulsevet_whatsapp: 'whatsapp', call_pulsevet_acibadem: 'call', transfer_to_number: 'call', navigate_to_pulsevet_acibadem: 'maps' })) {
        tools[name] = () => JSON.stringify(valid(session) ? { ok: true, uiButtonReady: true, action, requiresUserClick: true, executed: false, instruction: 'Kullanıcı klinik menüsünden ilgili düğmeye dokunarak işlemi başlatabilir. Uygulama dışı işlem gerçekleştirilmedi.' } : { ok: false, reason: 'session_ended' });
      }
      tools.update_sahika_suggestions = parameters => {
        if (!valid(session)) return JSON.stringify({ ok: false, reason: 'session_ended' });
        let data: unknown = parameters;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
        if (!data || typeof data !== 'object') return JSON.stringify({ ok: false, reason: 'invalid_parameters' });
        const source = data as Record<string, unknown>;
        const latest = [...messagesRef.current].reverse().find(message => message.role === 'user');
        const anchor = typeof source.based_on_user_message === 'string' ? normalize(source.based_on_user_message) : '';
        if (!latest || !anchor || !normalize(latest.text).startsWith(anchor)) return JSON.stringify({ ok: false, reason: 'stale_turn' });
        const questions = source.suppress_suggestions === true || !Array.isArray(source.questions) ? [] : [...new Set(source.questions.filter((question): question is string => typeof question === 'string' && question.length >= 6 && question.length <= 180 && question.trim().endsWith('?') && !/[<>\[\]{}]|https?:\/\//i.test(question)).map(question => question.trim()))].slice(0, 3);
        setSuggestions(questions);
        return JSON.stringify({ ok: true, count: questions.length, uiOnly: true, instruction: 'Bu arayüz sorularını sesli okuma.' });
      };
      session.startTimer = setTimeout(() => {
        if (!valid(session) || session.connected) return;
        const timeoutError = new Error('Bağlantı zaman aşımına uğradı. Yeniden deneyebilirsin.');
        session.ready.reject(timeoutError);
        setError(timeoutError.message);
        setLoading(false);
        void enqueue(endCurrent).catch(() => {});
      }, 30_000);
      const finishReady = () => {
        // SDK callback ordering is an implementation detail: require both signals.
        if (!valid(session) || !session.connected || !session.raw || session.prepared) return;
        session.prepared = true;
        clearTimeout(session.startTimer);
        setStatus('connected');
        if (requestedMode === 'voice') setMuted(true, session);
        const context = contextFor(messagesRef.current);
        if (context) session.raw.sendContextualUpdate(context);
        session.lifetimeTimer = setTimeout(() => {
          if (!valid(session)) return;
          ++intentRef.current;
          setError('Görüşme 10 dakikalık süreye ulaştı. Mesajların saklandı; yeniden bağlanarak devam edebilirsin.');
          session.cancelled = true;
          void enqueue(endCurrent).catch(() => {});
        }, Math.max(30, config.maxSessionSeconds) * 1_000);
        session.ready.resolve();
      };
      session.started = true;
      sdkRef.current.startSession({
        ...auth,
        initialMicMuted: requestedMode === 'voice',
        clientTools: tools,
        dynamicVariables: { interaction_mode: requestedMode === 'text' ? 'chat' : 'voice', is_voice_mode: requestedMode === 'voice', portal_authenticated: false, owner_code: '', owner_display_name: '', patient_names: '', patient_context_available: false },
        onConversationCreated: conversation => {
          session.raw = conversation;
          if (session.cancelled) { void conversation.endSession().finally(session.closed.resolve); return; }
          if (requestedMode === 'voice') conversation.setMicMuted(true);
          finishReady();
        },
        onConnect: () => {
          if (!valid(session)) return;
          session.connected = true;
          finishReady();
        },
        onStatusChange: event => {
          if (event.status === 'disconnected') {
            session.closed.resolve();
            if (!session.connected) session.ready.reject(new Error('Bağlantı kurulamadı. Yeniden deneyebilirsin.'));
          }
          if (valid(session)) setStatus(event.status);
        },
        onDisconnect: details => {
          clearTimers(session);
          session.connected = false;
          session.closed.resolve();
          session.ready.reject(new Error('Bağlantı sonlandı.'));
          if (!valid(session)) return;
          runtimeRef.current = null;
          setStatus('disconnected'); setMicMuted(true); setIsSpeaking(false); setLoading(false);
          if (details.reason === 'error') setError('Şahika ile bağlantı kesildi. Mesajların saklandı; yeniden deneyebilirsin.');
        },
        onError: () => {
          session.ready.reject(new Error('Şahika ile bağlantıda bir sorun oluştu. Yeniden deneyebilirsin.'));
          if (!session.connected) session.closed.resolve();
          if (!valid(session)) return;
          setLoading(false);
          setError('Şahika ile bağlantıda bir sorun oluştu. Yeniden deneyebilirsin.');
        },
        onModeChange: event => { if (valid(session)) setIsSpeaking(event.mode === 'speaking'); },
        onMessage: event => {
          if (!valid(session) || !event.message.trim()) return;
          const role: ChatMessage['role'] = event.role === 'user' ? 'user' : 'assistant';
          const eventKey = `${role}:${event.response_id ?? event.event_id}`;
          let messageId = session.events.get(eventKey);
          if (role === 'user') {
            const optimistic = session.optimistic.find(item => normalize(item.text) === normalize(event.message) && Date.now() - item.timestamp < 120_000);
            if (!messageId && optimistic) { messageId = optimistic.id; session.optimistic = session.optimistic.filter(item => item !== optimistic); }
            if (requestedMode === 'voice') setMuted(true, session);
            waitForAnswer(session);
          } else {
            clearTimeout(session.responseTimer);
            setLoading(false);
          }
          const now = Date.now();
          messageId ??= id();
          session.events.set(eventKey, messageId);
          const nextMessage: ChatMessage = { id: messageId, role, text: event.message.trim(), timestamp: now };
          const existing = messagesRef.current.findIndex(message => message.id === messageId);
          updateMessages(existing < 0 ? [...messagesRef.current, nextMessage] : messagesRef.current.map((message, index) => index === existing ? { ...nextMessage, timestamp: message.timestamp } : message));
        },
        onAgentResponseCorrection: event => {
          if (!valid(session)) return;
          const previousMessages = messagesRef.current;
          let index = previousMessages.length - 1;
          while (index >= 0 && (previousMessages[index].role !== 'assistant' || previousMessages[index].text !== event.original_agent_response)) --index;
          if (index >= 0) updateMessages(previousMessages.map((message, offset) => offset === index ? { ...message, text: event.corrected_agent_response } : message));
        },
      });
      await session.ready.promise;
      return session;
    } catch (failure) {
      clearTimeout(session.startTimer);
      if (!session.started) session.closed.resolve();
      if (runtimeRef.current === session && !session.started) {
        runtimeRef.current = null;
        if (mounted.current) { setStatus('disconnected'); setLoading(false); }
      } else if (valid(session)) { setStatus('disconnected'); setLoading(false); }
      throw failure;
    }
  }, [clearTimers, endCurrent, enqueue, setMuted, updateMessages, valid, waitForAnswer]);

  const onDraftChange = useCallback((value: string) => {
    draftRef.current = value;
    setDraft(value);
    const session = runtimeRef.current;
    if (session?.connected && !session.cancelled) { try { session.raw?.sendUserActivity(); } catch {} }
  }, []);

  const onSend = useCallback(() => {
    const text = draftRef.current.trim();
    if (!hydrated.current || !text || sending.current) return;
    sending.current = true;
    const intention = intentRef.current;
    setLoading(true); setError(null);
    void enqueue(async () => {
      if (intention !== intentRef.current) return;
      const session = await connect('text', intention);
      if (!valid(session) || intention !== intentRef.current) return;
      if (!session.raw) throw new Error('Sohbet bağlantısı henüz hazır değil. Yeniden deneyebilirsin.');
      const message: ChatMessage = { id: id(), role: 'user', text, timestamp: Date.now() };
      session.optimistic.push({ id: message.id, text, timestamp: message.timestamp });
      updateMessages([...messagesRef.current, message]);
      session.raw.sendUserMessage(text);
      // A user can keep typing while the first connection is being established.
      if (draftRef.current.trim() === text) { draftRef.current = ''; setDraft(''); }
      setSuggestions([]);
      waitForAnswer(session);
    }).catch(failure => {
      if (mounted.current && intention === intentRef.current) { setError(errorText(failure)); setLoading(false); }
    }).finally(() => { sending.current = false; });
  }, [connect, enqueue, updateMessages, valid, waitForAnswer]);

  const onSetMode = useCallback((nextMode: ChatMode) => {
    if (!hydrated.current) return;
    const current = runtimeRef.current;
    if (nextMode === 'voice' && current?.mode === 'voice' && !current.cancelled && current.connected) return;
    const intention = ++intentRef.current;
    cancelCurrent();
    mutedRef.current = true;
    modeRef.current = nextMode;
    setMode(nextMode); setError(null); setLoading(false); setMicMuted(true); setIsSpeaking(false);
    void enqueue(async () => {
      await endCurrent();
      if (intention !== intentRef.current || !mounted.current) return;
      if (nextMode === 'voice') await connect('voice', intention);
    }).catch(failure => {
      if (mounted.current && intention === intentRef.current) { setError(errorText(failure)); setStatus('disconnected'); }
    });
  }, [cancelCurrent, connect, endCurrent, enqueue]);

  const onEnd = useCallback(() => {
    ++intentRef.current;
    cancelCurrent();
    void enqueue(endCurrent).catch(failure => { if (mounted.current) setError(errorText(failure)); });
  }, [cancelCurrent, endCurrent, enqueue]);

  const replaceLocal = useCallback((session?: ChatSession) => {
    ++intentRef.current;
    cancelCurrent();
    mutedRef.current = true;
    localIdRef.current = session?.id ?? id();
    messagesRef.current = session?.messages.map(message => ({ ...message })) ?? [];
    draftRef.current = '';
    modeRef.current = 'text';
    setMessages(messagesRef.current); setDraft(''); setMode('text'); setError(null); setLoading(false); setMicMuted(true); setIsSpeaking(false); setSuggestions(INITIAL_SUGGESTIONS);
    void enqueue(endCurrent).catch(failure => { if (mounted.current) setError(errorText(failure)); });
  }, [cancelCurrent, endCurrent, enqueue]);

  const onLoadSession = useCallback((sessionId: string) => {
    const session = sessionsRef.current.find(item => item.id === sessionId);
    if (session) replaceLocal(cloneSession(session));
  }, [replaceLocal]);
  const onDeleteSession = useCallback((sessionId: string) => {
    if (sessionId === localIdRef.current) replaceLocal();
    persist(sessionsRef.current.filter(session => session.id !== sessionId));
  }, [persist, replaceLocal]);
  const onToggleMic = useCallback(() => {
    const session = runtimeRef.current;
    if (!session || session.mode !== 'voice' || !valid(session) || !session.connected) return;
    try { setMuted(!mutedRef.current, session); } catch { setError('Mikrofon durumu değiştirilemedi. Görüşmeyi yeniden başlatabilirsin.'); }
  }, [setMuted, valid]);

  useEffect(() => {
    mounted.current = true;
    const hydrationIntent = intentRef.current;
    void loadHistory().then(history => {
      if (!mounted.current) return;
      const copy = history.map(cloneSession);
      sessionsRef.current = copy;
      setSessions(copy);
      if (copy[0] && intentRef.current === hydrationIntent) {
        localIdRef.current = copy[0].id;
        messagesRef.current = copy[0].messages.map(message => ({ ...message }));
        setMessages(messagesRef.current);
      }
    }).catch(() => { if (mounted.current) setError('Sohbet geçmişi bu cihazdan okunamadı. Yeni bir sohbet başlatabilirsin.'); }).finally(() => {
      hydrated.current = true;
      if (mounted.current) setLoading(false);
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'inactive') {
        const active = runtimeRef.current;
        if (active?.mode === 'voice' && active.raw && active.connected && !active.cancelled) {
          try { setMuted(true, active); } catch {}
        }
        return;
      }
      if (state !== 'background') return;
      ++intentRef.current;
      const active = runtimeRef.current;
      if (active?.mode === 'voice' && active.raw && active.connected) {
        try { active.raw.setMicMuted(true); } catch {}
      }
      cancelCurrent();
      // Do not leave a live microphone behind when the app goes to the background.
      void enqueue(endCurrent).catch(() => {});
    });
    return () => {
      mounted.current = false;
      invalidateIntent();
      subscription.remove();
      cancelCurrent();
      const current = runtimeRef.current;
      if (current) clearTimers(current);
      void endCurrent().catch(() => {});
    };
  }, [cancelCurrent, clearTimers, endCurrent, enqueue, invalidateIntent, setMuted]);

  return { messages, sessions, mode, status, isSpeaking, micMuted, draft, error, loading, suggestions, onDraftChange, onSend, onSetMode, onToggleMic, onEnd, onNew: () => replaceLocal(), onLoadSession, onDeleteSession, onClearError: () => setError(null) };
}
