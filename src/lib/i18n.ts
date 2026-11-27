import { useEffect, useState } from 'react';

/**
 * App language (this device). Covers navigation, screen titles, Settings and the most-used
 * buttons; anything not translated yet falls back to English. Free — the words ship in the app.
 */
export const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'kn', label: 'ಕನ್ನಡ' },
  { id: 'ta', label: 'தமிழ்' },
  { id: 'te', label: 'తెలుగు' },
] as const;
export type Lang = (typeof LANGS)[number]['id'];

const D = {
  Map: { hi: 'मैप', kn: 'ನಕ್ಷೆ', ta: 'வரைபடம்', te: 'మ్యాప్' },
  Chat: { hi: 'चैट', kn: 'ಚಾಟ್', ta: 'அரட்டை', te: 'చాట్' },
  Camera: { hi: 'कैमरा', kn: 'ಕ್ಯಾಮೆರಾ', ta: 'கேமரா', te: 'కెమెరా' },
  Stories: { hi: 'स्टोरीज़', kn: 'ಸ್ಟೋರಿಗಳು', ta: 'கதைகள்', te: 'స్టోరీలు' },
  Spotlight: { hi: 'स्पॉटलाइट', kn: 'ಸ್ಪಾಟ್‌ಲೈಟ್', ta: 'ஸ்பாட்லைட்', te: 'స్పాట్‌లైట్' },
  Settings: { hi: 'सेटिंग्स', kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', ta: 'அமைப்புகள்', te: 'సెట్టింగ్‌లు' },
  Account: { hi: 'खाता', kn: 'ಖಾತೆ', ta: 'கணக்கு', te: 'ఖాతా' },
  Privacy: { hi: 'गोपनीयता', kn: 'ಗೌಪ್ಯತೆ', ta: 'தனியுரிமை', te: 'గోప్యత' },
  Security: { hi: 'सुरक्षा', kn: 'ಭದ್ರತೆ', ta: 'பாதுகாப்பு', te: 'భద్రత' },
  Notifications: { hi: 'सूचनाएँ', kn: 'ಅಧಿಸೂಚನೆಗಳು', ta: 'அறிவிப்புகள்', te: 'నోటిఫికేషన్‌లు' },
  'Look & feel': { hi: 'रूप-रंग', kn: 'ನೋಟ', ta: 'தோற்றம்', te: 'రూపం' },
  'Backup & restore': { hi: 'बैकअप और रीस्टोर', kn: 'ಬ್ಯಾಕಪ್ ಮತ್ತು ಮರುಸ್ಥಾಪನೆ', ta: 'காப்புப்பிரதி & மீட்டமை', te: 'బ్యాకప్ & రీస్టోర్' },
  Language: { hi: 'भाषा', kn: 'ಭಾಷೆ', ta: 'மொழி', te: 'భాష' },
  Appearance: { hi: 'दिखावट', kn: 'ಗೋಚರತೆ', ta: 'தோற்றம்', te: 'కనిపించే తీరు' },
  Light: { hi: 'लाइट', kn: 'ಬೆಳಕು', ta: 'ஒளி', te: 'లైట్' },
  Dark: { hi: 'डार्क', kn: 'ಗಾಢ', ta: 'இருள்', te: 'డార్క్' },
  Phone: { hi: 'फ़ोन', kn: 'ಫೋನ್', ta: 'போன்', te: 'ఫోన్' },
  'Text size': { hi: 'टेक्स्ट का आकार', kn: 'ಪಠ್ಯ ಗಾತ್ರ', ta: 'எழுத்து அளவு', te: 'అక్షర పరిమాణం' },
  'Data saver': { hi: 'डेटा सेवर', kn: 'ಡೇಟಾ ಉಳಿತಾಯ', ta: 'டேட்டா சேமிப்பு', te: 'డేటా సేవర్' },
  'App lock': { hi: 'ऐप लॉक', kn: 'ಆ್ಯಪ್ ಲಾಕ್', ta: 'ஆப் பூட்டு', te: 'యాప్ లాక్' },
  'Theme colour': { hi: 'थीम रंग', kn: 'ಥೀಮ್ ಬಣ್ಣ', ta: 'தீம் நிறம்', te: 'థీమ్ రంగు' },
  Background: { hi: 'पृष्ठभूमि', kn: 'ಹಿನ್ನೆಲೆ', ta: 'பின்னணி', te: 'నేపథ్యం' },
  'Sign out': { hi: 'साइन आउट', kn: 'ಸೈನ್ ಔಟ್', ta: 'வெளியேறு', te: 'సైన్ అవుట్' },
  All: { hi: 'सभी', kn: 'ಎಲ್ಲಾ', ta: 'அனைத்தும்', te: 'అన్నీ' },
  Unread: { hi: 'अपठित', kn: 'ಓದದ', ta: 'படிக்காதவை', te: 'చదవనివి' },
  Groups: { hi: 'ग्रुप', kn: 'ಗುಂಪುಗಳು', ta: 'குழுக்கள்', te: 'గ్రూపులు' },
  Streaks: { hi: 'स्ट्रीक', kn: 'ಸ್ಟ್ರೀಕ್', ta: 'தொடர்கள்', te: 'స్ట్రీక్‌లు' },
  Hidden: { hi: 'छिपे हुए', kn: 'ಮರೆಮಾಡಿದ', ta: 'மறைக்கப்பட்டவை', te: 'దాచినవి' },
  Friends: { hi: 'दोस्त', kn: 'ಸ್ನೇಹಿತರು', ta: 'நண்பர்கள்', te: 'స్నేహితులు' },
  'For you': { hi: 'आपके लिए', kn: 'ನಿಮಗಾಗಿ', ta: 'உங்களுக்காக', te: 'మీ కోసం' },
  'My story': { hi: 'मेरी स्टोरी', kn: 'ನನ್ನ ಸ್ಟೋರಿ', ta: 'என் கதை', te: 'నా స్టోరీ' },
  'Text story': { hi: 'टेक्स्ट स्टोरी', kn: 'ಪಠ್ಯ ಸ್ಟೋರಿ', ta: 'உரை கதை', te: 'టెక్స్ట్ స్టోరీ' },
  'Tap for photo · hold for video': { hi: 'फ़ोटो के लिए टैप · वीडियो के लिए दबाए रखें', kn: 'ಫೋಟೋಗೆ ಟ್ಯಾಪ್ · ವೀಡಿಯೊಗೆ ಒತ್ತಿ ಹಿಡಿಯಿರಿ', ta: 'புகைப்படம் தட்டவும் · வீடியோ அழுத்திப் பிடிக்கவும்', te: 'ఫోటోకి ట్యాప్ · వీడియోకి నొక్కి పట్టుకోండి' },
  'Question of the day': { hi: 'आज का सवाल', kn: 'ಇಂದಿನ ಪ್ರಶ್ನೆ', ta: 'இன்றைய கேள்வி', te: 'నేటి ప్రశ్న' },
  Answer: { hi: 'जवाब दें', kn: 'ಉತ್ತರಿಸಿ', ta: 'பதில்', te: 'జవాబు' },
  Quizzes: { hi: 'क्विज़', kn: 'ಕ್ವಿಜ್‌ಗಳು', ta: 'வினாடி வினா', te: 'క్విజ్‌లు' },
  'Search chats': { hi: 'चैट खोजें', kn: 'ಚಾಟ್ ಹುಡುಕಿ', ta: 'அரட்டைகளைத் தேடு', te: 'చాట్‌లు వెతకండి' },
  'Your chats live here': { hi: 'आपकी चैट यहाँ हैं', kn: 'ನಿಮ್ಮ ಚಾಟ್‌ಗಳು ಇಲ್ಲಿವೆ', ta: 'உங்கள் அரட்டைகள் இங்கே', te: 'మీ చాట్‌లు ఇక్కడ ఉంటాయి' },
  'Find friends': { hi: 'दोस्त खोजें', kn: 'ಸ್ನೇಹಿತರನ್ನು ಹುಡುಕಿ', ta: 'நண்பர்களைக் கண்டறி', te: 'స్నేహితులను కనుగొనండి' },
  'Ghost mode': { hi: 'घोस्ट मोड', kn: 'ಘೋಸ್ಟ್ ಮೋಡ್', ta: 'மறைநிலை', te: 'ఘోస్ట్ మోడ్' },
  Memories: { hi: 'यादें', kn: 'ನೆನಪುಗಳು', ta: 'நினைவுகள்', te: 'జ్ఞాపకాలు' },
  "You're offline": { hi: 'आप ऑफ़लाइन हैं', kn: 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ', ta: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்', te: 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు' },
} satisfies Record<string, Partial<Record<Exclude<Lang, 'en'>, string>>>;
export type I18nKey = keyof typeof D;

const KEY = 'snv-lang';
export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY) as Lang | null;
    if (v && LANGS.some((l) => l.id === v)) return v;
  } catch {
    /* ignore */
  }
  return 'en';
}
export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l;
  window.dispatchEvent(new Event('snv-lang'));
}
export function applyLang() {
  document.documentElement.lang = getLang();
}

/** Translate a known UI string (English is the key). */
export function t(key: I18nKey | string, lang: Lang = getLang()): string {
  if (lang === 'en') return key;
  return (D as Record<string, Partial<Record<string, string>>>)[key]?.[lang] ?? key;
}

/** Re-renders when the language changes; returns the translator. */
export function useT() {
  const [lang, set] = useState(getLang);
  useEffect(() => {
    const on = () => set(getLang());
    window.addEventListener('snv-lang', on);
    return () => window.removeEventListener('snv-lang', on);
  }, []);
  return (key: I18nKey | string) => t(key, lang);
}
