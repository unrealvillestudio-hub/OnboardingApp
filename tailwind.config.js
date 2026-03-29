/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07070F',
        surface: '#0E0E1A',
        's2': '#14142A',
        border: '#1E1E3A',
        accent: '#00FFD1',
        'accent-dim': 'rgba(0,255,209,0.08)',
        'accent-mid': 'rgba(0,255,209,0.2)',
        text: '#E8E8F5',
        muted: '#5A5A8A',
        warning: '#FFB800',
        error: '#FF4D6A',
        success: '#00FFD1',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
        'pulse-accent': 'pulseAccent 2s ease-in-out infinite',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseAccent: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};
