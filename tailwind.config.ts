import type { Config } from 'tailwindcss';

/**
 * "Bento" design system (owner-approved 2026-11-25): soft grey canvas, rounded
 * white / black / colour tiles, near-black ink, Inter (heavy, tight) display
 * type, and a faint oversized avatar/icon behind rows (components/ui/Ghost).
 *
 * Token names are kept from earlier iterations so the whole app re-themes from
 * here: `noir.*` = page & surface tones, `ink.*` = text, `ember.*` = accents
 * (black primary by default, pink, green, violet, blue, orange …).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: { DEFAULT: '#ECECEF', 950: '#FFFFFF', 900: '#ECECEF', 800: '#FFFFFF', 700: '#F1F1F4', 600: '#E6E6EB', 500: '#D6D6DC' },
        ember: {
          flame: 'rgb(var(--accent) / <alpha-value>)',
          amber: 'rgb(var(--accent) / <alpha-value>)',
          gold: '#FFB020',
          rose: '#FF5FA2',
          peach: '#FF9EC8',
          sage: '#18C48C',
          jade: '#12A577',
          plum: '#8C6BFF',
          sky: '#3D7BFF',
          cream: '#111111',
        },
        pearl: { blue: '#DDE8FF', pink: '#FFD6E8', mint: '#D8F5EA', lilac: '#ECE5FF' },
        ink: { DEFAULT: '#111111', soft: '#333333', mute: '#6F6F78', faint: '#9A9AA3' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        display: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { tile: '26px', '4xl': '2rem', '5xl': '2.5rem' },
      boxShadow: {
        glass: '0 16px 36px -24px rgba(17,17,17,0.35)',
        glow: '0 12px 28px -14px rgb(var(--accent) / 0.55)',
        card: '0 10px 26px -22px rgba(17,17,17,0.35)',
      },
      backgroundImage: {
        'ember-gradient': 'linear-gradient(115deg, rgb(var(--accent-from)) 0%, rgb(var(--accent)) 48%, rgb(var(--accent-to)) 100%)',
        'pearl-sheen': 'conic-gradient(from 210deg, #9FB8FF, #FFB3D9, #A8F0DC, #C9B6FF, #9FB8FF)',
      },
      keyframes: {
        'ember-drift': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(5%,-3%,0) scale(1.08)' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        flicker: { '0%,100%': { opacity: '1' }, '45%': { opacity: '0.82' }, '60%': { opacity: '0.94' } },
      },
      animation: {
        'ember-drift': 'ember-drift 22s ease-in-out infinite',
        'ember-drift-slow': 'ember-drift 30s ease-in-out infinite reverse',
        'spin-slow': 'spin-slow 7s linear infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        flicker: 'flicker 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
