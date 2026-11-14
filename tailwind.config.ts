import type { Config } from 'tailwindcss';

/**
 * "Ember Noir" design system — warm near-black, amber/flame/rose light,
 * cream ink, editorial serif display type. Original to SUMANOVA.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: { DEFAULT: '#0c0a09', 950: '#080706', 900: '#0c0a09', 800: '#15110f', 700: '#1e1916', 600: '#2a231e', 500: '#3a3029' },
        ember: {
          flame: '#ff7a3d',
          amber: '#ffb547',
          gold: '#e9c46a',
          rose: '#ff6b6b',
          peach: '#ffb38a',
          sage: '#a7d99a',
          jade: '#5fc9a8',
          plum: '#c084b4',
          sky: '#7cc4e8',
          cream: '#f4e9da',
        },
        ink: { DEFAULT: '#f6eee3', soft: '#d6c8b6', mute: '#9a8b7a', faint: '#665a4d' },
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,236,214,0.06) inset, 0 24px 48px -24px rgba(0,0,0,0.7)',
        glow: '0 10px 36px -10px rgba(255,122,61,0.65), 0 0 0 1px rgba(255,181,71,0.25)',
        card: '0 1px 0 0 rgba(255,236,214,0.05) inset, 0 18px 40px -22px rgba(0,0,0,0.8)',
      },
      backgroundImage: {
        'ember-gradient': 'linear-gradient(115deg, #ffc15a 0%, #ff7a3d 48%, #ff5e6c 100%)',
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
