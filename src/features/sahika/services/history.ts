import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatSession } from '../components/ChatScreen';

const STORAGE_KEY = 'sahika.native.history.v1';
let pendingWrite: Promise<void> = Promise.resolve();

export async function loadHistory(): Promise<ChatSession[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Konuşma geçmişi okunamadı.');
  return value.filter((s): s is ChatSession => s && typeof s.id === 'string' && typeof s.title === 'string' && Number.isFinite(s.updatedAt) && Array.isArray(s.messages))
    .map(s => ({ ...s, messages: s.messages.filter(m => m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && Number.isFinite(m.timestamp)) }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveHistory(sessions: ChatSession[]): Promise<void> {
  // Serialize writes so a slower previous save cannot resurrect deleted conversations.
  const payload = JSON.stringify(sessions);
  const result = pendingWrite.catch(() => {}).then(() => AsyncStorage.setItem(STORAGE_KEY, payload));
  pendingWrite = result;
  return result;
}
