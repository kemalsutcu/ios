import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { agents } from '../data/agents';
import { parseFavoriteIds } from '../lib/favoriteIds';

const KEY = 'yapay-mevzular:favorite-agent-ids:v1';
const Context = createContext({ ids: [] as string[], ready: false, error: '', toggle: (_id: string) => {}, clear: () => {} });

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const idsRef = useRef<string[]>([]);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY).then((value) => {
      if (!active) return;
      const loaded = parseFavoriteIds(value, agents.map((agent) => agent.id));
      idsRef.current = loaded;
      setIds(loaded);
    }).catch(() => { if (active) setError('Favoriler okunamadı; bu oturumda yeniden seçebilirsiniz.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  function persist(next: string[]) {
    if (!ready) return;
    idsRef.current = next;
    setIds(next);
    writes.current = writes.current.then(() => next.length ? AsyncStorage.setItem(KEY, JSON.stringify(next)) : AsyncStorage.removeItem(KEY))
      .then(() => setError('')).catch(() => setError('Favoriler bu cihaza kaydedilemedi.'));
  }
  return <Context.Provider value={{ ids, ready, error, toggle: (id) => {
    if (!agents.some((agent) => agent.id === id)) return;
    persist(idsRef.current.includes(id) ? idsRef.current.filter((item) => item !== id) : [...idsRef.current, id]);
  }, clear: () => persist([]) }}>{children}</Context.Provider>;
}
export const useFavorites = () => useContext(Context);
