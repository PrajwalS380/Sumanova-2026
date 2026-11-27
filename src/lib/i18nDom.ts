import { builtinWords, getLang, type Lang } from './i18n';

/**
 * Whole-app translation without touching every component: once a non-English language is chosen,
 * known English UI text on screen (text, placeholders, button labels, tooltips) is swapped for the
 * chosen language from a dictionary that ships with the app (src/i18n/<lang>.json, loaded on demand).
 * People's own words are never touched: anything inside translate="no" (messages, names, captions,
 * answers) is skipped, and only exact UI strings from the dictionary are replaced.
 */
const loaders = import.meta.glob('../i18n/*.json');
const ATTRS = ['placeholder', 'aria-label', 'title'] as const;
const SKIP = 'script,style,textarea,code,pre,[translate="no"],[contenteditable="true"]';

export const normKey = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/\s+/g, ' ').trim();

let dict: Map<string, string> | null = null;
let observer: MutationObserver | null = null;

/** Exact match, else a numbered pattern ("{n} friends" → "3 दोस्त"). */
export function lookup(d: Map<string, string>, text: string): string | null {
  const key = normKey(text);
  if (!key || key.length > 400 || !/[A-Za-z]/.test(key)) return null;
  const hit = d.get(key);
  if (hit) return hit;
  const nums = key.match(/\d[\d,.]*/g);
  if (!nums) return null;
  const pat = d.get(key.replace(/\d[\d,.]*/g, '{n}'));
  if (!pat) return null;
  let i = 0;
  return pat.replace(/\{n\}/g, () => nums[i++] ?? '');
}

function translateText(node: Text) {
  const v = node.nodeValue;
  if (!v || !dict) return;
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v)!;
  const tr = lookup(dict, m[2]);
  if (tr && tr !== m[2]) node.nodeValue = m[1] + tr + m[3];
}

function translateAttrs(el: Element) {
  if (!dict || el.closest('[translate="no"]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const tr = lookup(dict, v);
    if (tr && tr !== v) el.setAttribute(a, tr);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (el.matches(SKIP)) return;
  translateAttrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else translateAttrs(n as Element);
  }
}

export async function loadDictionary(lang: Lang): Promise<Map<string, string> | null> {
  if (lang === 'en') return null;
  const load = loaders[`../i18n/${lang}.json`];
  if (!load) return null;
  const mod = (await load()) as { default: Record<string, string> };
  return new Map(Object.entries({ ...mod.default, ...builtinWords(lang) }));
}

/** Start translating the whole page (call once at start-up). No-op for English. */
export async function startScreenTranslation(lang: Lang = getLang()) {
  if (lang === 'en' || observer) return;
  dict = await loadDictionary(lang).catch(() => null);
  if (!dict) return;
  translateTree(document.body);
  let queue: Node[] = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const q = queue;
    queue = [];
    for (const n of q) if (n.isConnected) translateTree(n);
  };
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach((n) => queue.push(n));
      else if (r.type === 'characterData') queue.push(r.target);
      else if (r.type === 'attributes') translateAttrs(r.target as Element);
    }
    if (!scheduled && queue.length) {
      scheduled = true;
      queueMicrotask(flush);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}
