import type { ReactNode } from 'react';

// A web export must never load the native ElevenLabs / LiveKit modules.
export function NativeSahika({ fallback }: { fallback: ReactNode }) {
  return <>{fallback}</>;
}
