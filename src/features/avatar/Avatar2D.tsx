import { memo } from 'react';
import { shade, skinWithUndertone, type AvatarConfig } from './config';

/**
 * Lightweight SVG bust used when WebGL isn't available, and for quick
 * thumbnails. Driven by the same config as the 3D model.
 */
export const Avatar2D = memo(function Avatar2D({ config: c, size = 240 }: { config: AvatarConfig; size?: number }) {
  const skin = skinWithUndertone(c.skin, c.undertone);
  const fw = 62 * c.face.width * ({ oval: 1, round: 1.06, square: 1.05, heart: 1.02, long: 0.95 }[c.face.shape]);
  const fh = 74 * c.face.height * ({ oval: 1.06, round: 1, square: 1.02, heart: 1.04, long: 1.12 }[c.face.shape]);
  const e = c.expression;
  const eyeY = 100;
  const smile = e === 'sad' || e === 'crying' ? -1 : e === 'neutral' || e === 'sleeping' || e === 'angry' ? 0 : 1;
  const hair = c.hair.color;
  const top = c.outfit.topColor;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label="Avatar">
      <defs>
        <radialGradient id="a2bg" cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#2a1f5c" />
          <stop offset="1" stopColor="#1e1916" />
        </radialGradient>
      </defs>
      <rect width="200" height="220" rx="36" fill="url(#a2bg)" />
      {/* shoulders */}
      <path d={`M30 220 Q30 160 100 155 Q170 160 170 220 Z`} fill={top} />
      {c.outfit.top === 'hoodie' && <path d="M62 165 Q100 190 138 165" stroke={shade(top, -0.15)} strokeWidth="10" fill="none" />}
      <rect x="88" y="138" width="24" height="22" rx="10" fill={skin} />
      {/* long hair behind */}
      {(c.hair.style === 'long' || c.hair.style === 'wavy') && <ellipse cx="100" cy="125" rx={fw + 8} ry={fh + 20} fill={hair} />}
      {c.hair.style === 'afro' && <circle cx="100" cy="82" r={fw + 26} fill={hair} />}
      {/* face */}
      <ellipse cx="100" cy="100" rx={fw} ry={fh} fill={skin} />
      <ellipse cx={100 - fw} cy="102" rx="9" ry="14" fill={skin} />
      <ellipse cx={100 + fw} cy="102" rx="9" ry="14" fill={skin} />
      {(e === 'blushing' || e === 'laughing') && (
        <>
          <ellipse cx={100 - fw * 0.55} cy="118" rx="11" ry="7" fill="#f08a9a" opacity=".7" />
          <ellipse cx={100 + fw * 0.55} cy="118" rx="11" ry="7" fill="#f08a9a" opacity=".7" />
        </>
      )}
      {/* hair top */}
      {c.hair.style !== 'bald' && c.hair.style !== 'afro' && (
        <path d={`M${100 - fw - 4} ${100 - fh * 0.15} Q${100 - fw} ${100 - fh - 18} 100 ${100 - fh - 14} Q${100 + fw} ${100 - fh - 18} ${100 + fw + 4} ${100 - fh * 0.15} Q${100 + fw * 0.6} ${100 - fh * 0.7} 100 ${100 - fh * 0.62} Q${100 - fw * 0.6} ${100 - fh * 0.7} ${100 - fw - 4} ${100 - fh * 0.15}Z`} fill={hair} opacity={c.hair.style === 'buzz' ? 0.7 : 1} />
      )}
      {c.hair.style === 'bun' && <circle cx="100" cy={100 - fh - 16} r="16" fill={hair} />}
      {c.hair.style === 'curly' && [0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx={100 - fw + (i * fw * 2) / 6} cy={100 - fh + 4 - (i % 2) * 6} r="12" fill={hair} />)}
      {/* eyes */}
      {[-1, 1].map((s) => {
        const cx = 100 + s * fw * 0.42;
        const closed = e === 'sleeping' || e === 'laughing' || (e === 'winking' && s > 0);
        return (
          <g key={s}>
            {closed ? (
              <path d={`M${cx - 9} ${eyeY} Q${cx} ${eyeY + (e === 'laughing' ? -7 : 6)} ${cx + 9} ${eyeY}`} stroke="#2a1d18" strokeWidth="3" fill="none" strokeLinecap="round" />
            ) : (
              <>
                <ellipse cx={cx} cy={eyeY} rx={10 * c.eyes.size} ry={(c.eyes.shape === 'hooded' ? 6 : 8) * c.eyes.size * (e === 'surprised' ? 1.25 : 1)} fill="#fff" />
                <circle cx={cx} cy={eyeY + 1} r={5.5 * c.eyes.size} fill={c.eyes.color} />
                <circle cx={cx} cy={eyeY + 1} r={2.6 * c.eyes.size} fill="#0b0b10" />
                <circle cx={cx + 2} cy={eyeY - 2} r="1.5" fill="#fff" />
              </>
            )}
            <path d={`M${cx - 11} ${eyeY - 15 - (e === 'surprised' ? 5 : 0)} Q${cx} ${eyeY - 19 + (e === 'angry' ? s * -4 : 0)} ${cx + 11} ${eyeY - 15 + (e === 'angry' ? 4 : e === 'sad' ? -3 : 0)}`} stroke={c.eyes.browColor} strokeWidth={c.eyes.brow === 'bold' ? 5 : 3} fill="none" strokeLinecap="round" />
            {e === 'crying' && <ellipse cx={cx} cy={eyeY + 16} rx="3" ry="5" fill="#7dd3fc" />}
          </g>
        );
      })}
      {c.accessories.glasses !== 'none' &&
        [-1, 1].map((s) => (
          <circle key={s} cx={100 + s * fw * 0.42} cy={eyeY} r="15" fill={c.accessories.glasses === 'sunglasses' ? '#0b0b14' : 'none'} fillOpacity=".85" stroke="#151519" strokeWidth="3" />
        ))}
      {/* nose + mouth */}
      <ellipse cx="100" cy="122" rx={6 * c.nose.width * (c.nose.shape === 'wide' ? 1.3 : 1)} ry={5 * c.nose.size} fill={shade(skin, -0.06)} />
      {e === 'surprised' ? (
        <ellipse cx="100" cy="143" rx="7" ry="10" fill="#3b1515" />
      ) : e === 'laughing' ? (
        <path d="M84 138 Q100 162 116 138 Z" fill="#4a1a1f" />
      ) : (
        <path d={`M${86} ${141} Q100 ${141 + smile * 12} ${114} ${141}`} stroke={c.mouth.color} strokeWidth={c.mouth.shape === 'full' ? 5 : 3.5} fill="none" strokeLinecap="round" />
      )}
      {c.facialHair.style !== 'none' && c.facialHair.style !== 'moustache' && (
        <path d={`M${100 - fw * 0.85} 118 Q100 ${100 + fh + (c.facialHair.style === 'full' ? 22 : 10)} ${100 + fw * 0.85} 118 Q100 ${150} ${100 - fw * 0.85} 118Z`} fill={c.facialHair.color} opacity={c.facialHair.style === 'stubble' ? 0.35 : 0.95} />
      )}
      {(c.facialHair.style === 'moustache' || c.facialHair.style === 'short' || c.facialHair.style === 'full') && <path d="M86 134 Q100 128 114 134" stroke={c.facialHair.color} strokeWidth="6" strokeLinecap="round" fill="none" />}
      {c.accessories.bindi && <circle cx="100" cy="82" r="3" fill="#dc2626" />}
      {c.accessories.hat === 'cap' && <path d={`M${100 - fw - 6} ${100 - fh * 0.45} Q100 ${100 - fh - 40} ${100 + fw + 6} ${100 - fh * 0.45} L${100 + fw + 30} ${100 - fh * 0.4} Z`} fill={shade(top, -0.1)} />}
      {c.accessories.hat === 'beanie' && <path d={`M${100 - fw - 6} ${100 - fh * 0.4} Q100 ${100 - fh - 46} ${100 + fw + 6} ${100 - fh * 0.4} Z`} fill={shade(top, -0.1)} />}
    </svg>
  );
});
