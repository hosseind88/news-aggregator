import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore } from './preferencesStore';

/** Public hook for components; hides the store implementation. */
export function usePreferences() {
  const preferences = usePreferencesStore(useShallow((state) => state));
  const hasPreferences =
    preferences.sources.length + preferences.categories.length + preferences.authors.length > 0;
  return { ...preferences, hasPreferences };
}
