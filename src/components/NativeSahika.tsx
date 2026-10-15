import type { ReactNode } from 'react';
import SahikaApp from '../features/sahika/SahikaApp';

// Keep the native voice provider scoped to this screen rather than the catalog.
export function NativeSahika(_props: { fallback: ReactNode }) {
  return <SahikaApp />;
}
