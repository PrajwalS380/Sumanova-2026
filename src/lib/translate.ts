/**
 * On-device message translation with the browser's built-in Translator API (Chrome 138+ on
 * desktop / some Android browsers). Nothing is sent to a server, so it's free — but it only
 * exists where the browser ships it; everywhere else the "Translate" option is hidden.
 */
type TranslatorCtor = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<{ translate(t: string): Promise<string> }>;
};
type DetectorCtor = { create(): Promise<{ detect(t: string): Promise<{ detectedLanguage: string; confidence: number }[]> }> };

const g = globalThis as unknown as { Translator?: TranslatorCtor; LanguageDetector?: DetectorCtor };

export const translateSupported = () => !!g.Translator && !!g.LanguageDetector;

/** The person's own language: the app language if set, else the phone's. */
export function myLanguage() {
  try {
    const l = localStorage.getItem('snv-lang');
    if (l) return l;
  } catch {
    /* ignore */
  }
  return (navigator.language || 'en').split('-')[0];
}

let detector: Promise<{ detect(t: string): Promise<{ detectedLanguage: string; confidence: number }[]> }> | null = null;
const translators = new Map<string, Promise<{ translate(t: string): Promise<string> }>>();

export async function translateText(text: string, target = myLanguage()): Promise<{ text: string; from: string } | null> {
  if (!translateSupported()) return null;
  detector ??= g.LanguageDetector!.create();
  const [best] = await (await detector).detect(text);
  const from = best?.detectedLanguage;
  if (!from || from === 'und' || from === target) return { text, from: from ?? target };
  const key = `${from}>${target}`;
  if ((await g.Translator!.availability({ sourceLanguage: from, targetLanguage: target })) === 'unavailable') throw new Error('This language pair isn’t available on this device');
  let t = translators.get(key);
  if (!t) {
    t = g.Translator!.create({ sourceLanguage: from, targetLanguage: target });
    translators.set(key, t);
  }
  return { text: await (await t).translate(text), from };
}
