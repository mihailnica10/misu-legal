import en from '@/locales/en.json';
import ro from '@/locales/ro.json';

type DeepRecord = { [key: string]: string | DeepRecord };
type LocaleMessages = typeof en;

const messages: Record<string, LocaleMessages> = { en, ro };

function getNestedValue(obj: DeepRecord, path: string): string {
  const keys = path.split('.');
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path;
    current = current[key];
  }
  return typeof current === 'string' ? current : path;
}

function getBrowserLocale(): string {
  if (typeof window === 'undefined') return 'en';
  const lang = navigator.language || (navigator as any).userLanguage || 'en';
  const code = lang.split('-')[0];
  return code === 'ro' ? 'ro' : 'en';
}

function getStoredLocale(): string {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem('misu_locale') || 'en';
}

export function setLocale(locale: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('misu_locale', locale);
  }
}

export function getLocale(): string {
  const stored = getStoredLocale();
  if (stored === 'ro' || stored === 'en') return stored;
  return getBrowserLocale();
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const locale = getLocale();
  const msg = messages[locale] || messages.en;
  let value = getNestedValue(msg as unknown as DeepRecord, key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{{${k}}}`, String(v));
    }
  }
  return value;
}

export function useLocale() {
  return {
    t,
    locale: getLocale(),
    setLocale,
  };
}
