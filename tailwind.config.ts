import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: { DEFAULT: '#070814', 900: '#070814', 800: '#0d0f22', 700: '#141733', 600: '#1d2145' },
        aurora: {
          violet: '#8b5cf6',
          iris: '#a78bfa',
          teal: '#2dd4bf',
          mint: '#5eead4',
          coral: '#fb7185',
          peach: '#fdba74',
          gold: '#fbbf24',
          sky: '#38bdf8',
        },
        ink: { DEFAULT: '#f5f3ff', soft: '#c4c1e0', mute: '#8a87ab', faint: '#5b5880' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
        display: ['"Unbounded Variable"', '"Plus Jakarta Sans Variable"', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 20px 50px -20px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(167,139,250,0.35), 0 10px 40px -8px rgba(139,92,246,0.55)',
      },
      backgroundImage: {
        'aurora-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #2dd4bf 50%, #fb7185 100%)',
      },
      keyframes: {
        'aurora-drift': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(6%,-4%,0) scale(1.12)' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'aurora-drift': 'aurora-drift 18s ease-in-out infinite',
        'aurora-drift-slow': 'aurora-drift 26s ease-in-out infinite reverse',
        'spin-slow': 'spin-slow 6s linear infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
