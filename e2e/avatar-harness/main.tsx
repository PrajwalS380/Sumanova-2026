import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import type { AvatarStageHandle } from '@/features/avatar/AvatarStage';
import { AvatarStage } from '@/features/avatar/AvatarStage';
import { DEFAULT_AVATAR, type AvatarConfig } from '@/features/avatar/config';

const q = new URLSearchParams(location.search);
const d = DEFAULT_AVATAR;
const variants: Partial<AvatarConfig>[] = [
  {},
  { skin: '#f6cfae', hair: { style: 'long', color: '#2f1d14' }, outfit: { top: 'saree', topColor: '#c2577f', bottom: 'skirt', bottomColor: '#c2577f', shoes: 'sandals', shoeColor: '#e9c46a' }, accessories: { ...d.accessories, earrings: true, bindi: true, necklace: true }, expression: 'blushing', eyes: { ...d.eyes, shape: 'almond', lashes: true } },
  { skin: '#8a5532', hair: { style: 'afro', color: '#141010' }, facialHair: { style: 'short', color: '#141010' }, outfit: { top: 'jacket', topColor: '#7c4a2d', bottom: 'jeans', bottomColor: '#1e3a8a', shoes: 'boots', shoeColor: '#3a2a1f' }, accessories: { ...d.accessories, glasses: 'round', watch: true }, expression: 'laughing' },
  { skin: '#ecb98f', hair: { style: 'ponytail', color: '#a8703f' }, outfit: { top: 'tshirt', topColor: '#14b8a6', bottom: 'shorts', bottomColor: '#f5f5f7', shoes: 'sneakers', shoeColor: '#ff7a3d' }, expression: 'winking', pose: 'waving' },
  { skin: '#c68555', hair: { style: 'quiff', color: '#141010' }, facialHair: { style: 'full', color: '#141010' }, outfit: { top: 'blazer', topColor: '#16161f', bottom: 'trousers', bottomColor: '#16161f', shoes: 'formal', shoeColor: '#16161f' }, expression: 'neutral', accessories: { ...d.accessories, glasses: 'square' } },
  { skin: '#fde3cf', hair: { style: 'bun', color: '#e8cf9a' }, outfit: { top: 'kurta', topColor: '#f59e0b', bottom: 'dhoti', bottomColor: '#fde68a', shoes: 'sandals', shoeColor: '#7c4a2d' }, expression: 'surprised', accessories: { ...d.accessories, hat: 'none' } },
  { skin: '#4e2c19', hair: { style: 'braids', color: '#141010' }, outfit: { top: 'shirt', topColor: '#f5f5f7', bottom: 'skirt', bottomColor: '#dc2626', shoes: 'sneakers', shoeColor: '#f5f5f7' }, expression: 'sad', pose: 'celebrating' },
  { skin: '#d9a074', hair: { style: 'curly', color: '#4e2f1f' }, outfit: { top: 'hoodie', topColor: '#16161f', bottom: 'jeans', bottomColor: '#2563eb', shoes: 'sneakers', shoeColor: '#f5f5f7' }, accessories: { ...d.accessories, hat: 'beanie' }, expression: 'angry', pose: 'sitting' },
];
const only = q.get('i');
const list = only !== null ? [variants[+only]] : variants;
const size = only !== null ? 720 : 360;
function Bust({ i }: { i: number }) {
  const ref = useRef<AvatarStageHandle>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    const t = setTimeout(async () => setUrl(URL.createObjectURL(await ref.current!.capture('bust'))), 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ width: 400, height: 500 }}><AvatarStage ref={ref} configs={[{ ...d, ...variants[i] }]} interactive={false} /></div>
      {url && <img src={url} style={{ width: 360, height: 360, borderRadius: 999, objectFit: 'cover', background: '#2a1d16' }} />}
    </div>
  );
}
function App() {
  if (q.get('bust')) return <Bust i={+q.get('bust')!} />;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {list.map((v, i) => (
        <div key={i} style={{ width: size, height: size * 1.25 }}>
          <AvatarStage configs={[{ ...d, ...v }]} interactive={false} className="stage" />
        </div>
      ))}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
// bust: ?bust=N renders the profile-photo framing via capture()
