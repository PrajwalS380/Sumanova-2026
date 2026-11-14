import type { Config } from 'tailwindcss';

/**
 * "Pearl" design system — milky white glass over a soft blue / pink / mint
 * pearl sheen, navy ink, indigo accent, Instrument Serif display type.
 *
 * Token names are kept from earlier iterations so the whole app re-themes from
 * here: `noir.*` = page & surface tones (light), `ink.*` = text (navy),
 * `ember.*` = accents (indigo primary, pink, mint, gold …).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: { DEFAULT: '#F4F6FD', 950: '#FFFFFF', 900: '#F4F6FD', 800: '#FFFFFF', 700: '#EEF1FA', 600: '#E3E8F6', 500: '#D3DAEE' },
        ember: {
          flame: '#3D4FE0',
          amber: '#4453E6',
          gold: '#C78A0B',
          rose: '#E5487F',
          peach: '#FF9EC0',
          sage: '#11936F',
          jade: '#0E8C7D',
          plum: '#8E5BEA',
          sky: '#2F7FC2',
          cream: '#1E2A4A',
        },
        pearl: { blue: '#C9D8FF', pink: '#F6D3EC', mint: '#C8F2E6', lilac: '#E4DCFF' },
        ink: { DEFAULT: '#1E2A4A', soft: '#3E4C70', mute: '#5B6A8E', faint: '#8390B2' },
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.9) inset, 0 18px 40px -22px rgba(61,79,224,0.35)',
        glow: '0 12px 30px -12px rgba(61,79,224,0.55)',
        card: '0 1px 0 0 rgba(255,255,255,0.9) inset, 0 12px 30px -20px rgba(30,42,74,0.35)',
      },
      backgroundImage: {
        'ember-gradient': 'linear-gradient(115deg, #6E7BFF 0%, #3D4FE0 48%, #8E5BEA 100%)',
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
