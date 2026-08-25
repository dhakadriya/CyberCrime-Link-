/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: 'rgba(var(--slate-50), <alpha-value>)',
          100: 'rgba(var(--slate-100), <alpha-value>)',
          200: 'rgba(var(--slate-200), <alpha-value>)',
          300: 'rgba(var(--slate-300), <alpha-value>)',
          400: 'rgba(var(--slate-400), <alpha-value>)',
          500: 'rgba(var(--slate-500), <alpha-value>)',
          600: 'rgba(var(--slate-600), <alpha-value>)',
          700: 'rgba(var(--slate-700), <alpha-value>)',
          800: 'rgba(var(--slate-800), <alpha-value>)',
          900: 'rgba(var(--slate-900), <alpha-value>)',
          950: 'rgba(var(--slate-950), <alpha-value>)',
        },
        indigo: {
          50: 'rgba(var(--indigo-50), <alpha-value>)',
          100: 'rgba(var(--indigo-100), <alpha-value>)',
          400: 'rgba(var(--indigo-400), <alpha-value>)',
          500: 'rgba(var(--indigo-500), <alpha-value>)',
          600: 'rgba(var(--indigo-600), <alpha-value>)',
          700: 'rgba(var(--indigo-700), <alpha-value>)',
          900: 'rgba(var(--indigo-900), <alpha-value>)',
        },
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Intelligence platform accent colors
        intel: {
          blue: '#3b82f6',
          indigo: '#6366f1',
          violet: '#8b5cf6',
          emerald: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          orange: '#f97316',
          cyan: '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
