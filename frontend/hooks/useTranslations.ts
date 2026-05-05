'use client';

import { useTranslationContext } from '../components/TranslationProvider';

export function useTranslations(namespace?: string) {
  const { messages, fallbackMessages } = useTranslationContext();

  const resolveNestedValue = (source: Record<string, unknown>, fullKey: string): string | null => {
    const keys = fullKey.split('.');
    let value: unknown = source;

    for (const keyPart of keys) {
      if (value && typeof value === 'object' && keyPart in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[keyPart];
      } else {
        return null;
      }
    }

    return typeof value === 'string' ? value : null;
  };

  return function t(key: string): string {
    // Keep namespace-based lookup behavior in this slice.
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const activeValue = resolveNestedValue(messages as Record<string, unknown>, fullKey);
    if (activeValue !== null) {
      return activeValue;
    }

    const fallbackValue = resolveNestedValue(
      fallbackMessages as Record<string, unknown>,
      fullKey,
    );
    if (fallbackValue !== null) {
      return fallbackValue;
    }

    return fullKey;
  };
}

export function useLocale() {
  const { locale } = useTranslationContext();
  return locale;
}
