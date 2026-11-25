import { isNative, platform } from './platform';

/**
 * Speak to type (Android app): uses the phone's own speech recogniser through a free plugin.
 * Words appear in the message box as you speak. Not available on the website or iPhone build.
 */
export const dictationSupported = isNative && platform === 'android';

export async function startDictation(onText: (t: string) => void, onEnd: () => void): Promise<() => void> {
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error('Speech recognition isn’t available on this phone');
  const perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') throw new Error('Allow the microphone to speak to type');
  const partial = await SpeechRecognition.addListener('partialResults', (d) => d.matches?.[0] && onText(d.matches[0]));
  const state = await SpeechRecognition.addListener('listeningState', (d) => d.status === 'stopped' && onEnd());
  await SpeechRecognition.start({ language: navigator.language || 'en-IN', partialResults: true, popup: false, maxResults: 1 });
  return () => {
    void SpeechRecognition.stop().catch(() => undefined);
    void partial.remove();
    void state.remove();
  };
}
