import { config } from '../config';
import type { ChatMode } from '../components/ChatScreen';

export type SessionOptions =
  | { signedUrl: string; connectionType: 'websocket'; textOnly: true }
  | { conversationToken: string; connectionType: 'webrtc'; textOnly: false };
export type SessionSettings = { agentId: string; branchId: string; sessionEndpoint: string };

/** Public WebSocket URLs support branch selection without distributing an API key. */
export function buildPublicTextUrl(agentId: string, branchId: string): string {
  const url = new URL('wss://api.elevenlabs.io/v1/convai/conversation');
  url.searchParams.set('agent_id', agentId);
  if (branchId) url.searchParams.set('branch_id', branchId);
  return url.toString();
}

function requiredString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * A public agent needs no app-bundled secret. A private agent can instead use
 * the optional HTTPS server endpoint, whose response contains a short-lived
 * session credential, never the ElevenLabs account API key.
 */
export async function getSessionOptions(mode: ChatMode, signal?: AbortSignal, settings: SessionSettings = config, request: typeof fetch = fetch): Promise<SessionOptions> {
  if (signal?.aborted) throw new Error('Bağlantı isteği iptal edildi.');
  if (mode === 'text' && !settings.sessionEndpoint) {
    return { signedUrl: buildPublicTextUrl(settings.agentId, settings.branchId), connectionType: 'websocket', textOnly: true };
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 20_000);
  try {
    const url = settings.sessionEndpoint
      ? new URL(settings.sessionEndpoint)
      : new URL('https://api.elevenlabs.io/v1/convai/conversation/token');
    if (url.protocol !== 'https:') throw new Error('Oturum sunucusunun adresi HTTPS olmalı.');
    if (!settings.sessionEndpoint) {
      url.searchParams.set('agent_id', settings.agentId);
      if (settings.branchId) url.searchParams.set('branch_id', settings.branchId);
    }
    const response = await request(url.toString(), {
      method: settings.sessionEndpoint ? 'POST' : 'GET',
      headers: settings.sessionEndpoint ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      ...(settings.sessionEndpoint ? { body: JSON.stringify({ mode, agentId: settings.agentId, branchId: settings.branchId }) } : {}),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Ajan bu bağlantı için yetkilendirme istiyor. Özel ajan kullanılıyorsa oturum sunucusu ayarlanmalı.');
      }
      throw new Error(`Şahika’ya bağlanılamadı (HTTP ${response.status}). Biraz sonra yeniden dene.`);
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') throw new Error('Oturum sunucusundan geçerli bir yanıt alınamadı.');
    const data = body as Record<string, unknown>;
    if (mode === 'text') {
      const signedUrl = requiredString(data.signedUrl) ?? requiredString(data.signed_url);
      if (!signedUrl || new URL(signedUrl).protocol !== 'wss:') throw new Error('Yazılı sohbet bağlantısı alınamadı.');
      return { signedUrl, connectionType: 'websocket', textOnly: true };
    }
    const conversationToken = requiredString(data.conversationToken) ?? requiredString(data.token);
    if (!conversationToken) throw new Error('Sesli görüşme bağlantısı alınamadı.');
    return { conversationToken, connectionType: 'webrtc', textOnly: false };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(signal?.aborted ? 'Bağlantı isteği iptal edildi.' : 'Bağlantı zaman aşımına uğradı. İnternet bağlantını kontrol edip yeniden dene.');
    }
    if (error instanceof TypeError || error instanceof SyntaxError) {
      throw new Error('Şahika’ya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
