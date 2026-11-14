import { memo } from 'react';
import { variant, type Look } from './look/config';
import { mix } from './sculpt';

/** Lightweight SVG bust used when WebGL isn't available. Driven by the same Look as the 3D model. */
export const Avatar2D = memo(function Avatar2D({ config: l, size = 240 }: { config: Look; size?: number }) {
  const skin = l.skin;
  const head = variant(l, 'head')!.p;
  const fw = 62 * (head.rx / 0.35);
  const fh = 74 * (head.ry / 0.39);
  const e = l.expression;
  const smile = e === 'sad' || e === 'crying' ? -1 : e === 'neutral' || e === 'sleeping' || e === 'angry' ? 0 : 1;
  const hair = l.color.hair ?? '#2a1d16';
  const top = l.color.top ?? variant(l, 'top')?.p.c1 ?? variant(l, 'dress')?.p.c1 ?? '#e9e2d6';
  const hasHair = l.pick.hair != null;
  const longHair = hasHair && /Long|Lob|Bob|Locs|Shag/.test(variant(l, 'hair')!.family);
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label="Avatar">
      <defs>
        <radialGradient id="a2bg" cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#3a2a22" />
          <stop offset="1" stopColor="#1e1916" />
        </radialGradient>
      </defs>
      <rect width="200" height="220" rx="36" fill="url(#a2bg)" />
      {longHair && <ellipse cx="100" cy="120" rx={fw + 14} ry={fh + 30} fill={hair} />}
      <path d="M30 220 Q30 160 100 155 Q170 160 170 220 Z" fill={top} />
      <rect x="88" y="138" width="24" height="22" rx="10" fill={skin} />
      <ellipse cx={100 - fw} cy="104" rx="8" ry="12" fill={skin} />
      <ellipse cx={100 + fw} cy="104" rx="8" ry="12" fill={skin} />
      <ellipse cx="100" cy="98" rx={fw} ry={fh} fill={skin} />
      {hasHair && <path d={`M${100 - fw - 4} 96 Q${100 - fw} ${98 - fh - 14} 100 ${98 - fh - 10} Q${100 + fw} ${98 - fh - 14} ${100 + fw + 4} 96 Q${100 + fw - 6} 64 100 70 Q${100 - fw + 6} 64 ${100 - fw - 4} 96 Z`} fill={hair} />}
      {[-1, 1].map((s) => (
        <g key={s}>
          {e === 'sleeping' || e === 'laughing' || (e === 'winking' && s > 0) ? (
            <path d={`M${100 + s * 24 - 9} 100 Q${100 + s * 24} ${e === 'laughing' ? 93 : 106} ${100 + s * 24 + 9} 100`} stroke="#2a1d18" strokeWidth="3" fill="none" strokeLinecap="round" />
          ) : (
            <>
              <ellipse cx={100 + s * 24} cy="100" rx="9" ry="10" fill="#fff" />
              <circle cx={100 + s * 24} cy="101" r="6" fill={l.color.eyes ?? '#4e2f1f'} />
              <circle cx={100 + s * 24 + 2} cy="98" r="2" fill="#fff" />
            </>
          )}
          <path d={`M${100 + s * 14} 84 Q${100 + s * 24} 79 ${100 + s * 34} 84`} stroke={l.color.brows ?? '#2a1d16'} strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      ))}
      <path d="M96 118 Q100 124 104 118" stroke={mix(skin, '#000000', 0.25)} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={`M86 ${134 - smile * 2} Q100 ${134 + smile * 9} 114 ${134 - smile * 2}`} stroke={l.color.lips ?? '#b86b6b'} strokeWidth="4" fill="none" strokeLinecap="round" />
      {l.pick.beard != null && <path d={`M${100 - fw + 6} 116 Q100 ${98 + fh + 18} ${100 + fw - 6} 116 Q100 ${98 + fh + 2} ${100 - fw + 6} 116 Z`} fill={l.color.beard ?? hair} opacity="0.9" />}
    </svg>
  );
});
