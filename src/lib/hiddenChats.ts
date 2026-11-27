/** Hidden chats (this device): kept out of the chat list until the app-lock PIN is entered. */
const key = (uid: string) => `snv-hidden-chats-${uid}`;

export function hiddenChats(uid: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key(uid)) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function setChatHidden(uid: string, id: string, hide: boolean) {
  const s = hiddenChats(uid);
  if (hide) s.add(id);
  else s.delete(id);
  try {
    localStorage.setItem(key(uid), JSON.stringify([...s]));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event('snv-hidden-changed'));
  return s;
}
