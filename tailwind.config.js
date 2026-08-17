/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '11': ['11px', { lineHeight: '15px' }],
        '12': ['12px', { lineHeight: '17px' }],
        '13': ['13px', { lineHeight: '18px' }],
        '14': ['14px', { lineHeight: '20px' }],
        '15': ['15px', { lineHeight: '22px' }],
        // Glib.money mobile scale (§3.2)
        'g-display': ['28px', { lineHeight: '32px', fontWeight: '700' }],
        'g-h1': ['22px', { lineHeight: '28px', fontWeight: '700' }],
        'g-h2': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'g-body': ['15px', { lineHeight: '22px' }],
        'g-label': ['13px', { lineHeight: '18px', fontWeight: '600' }],
        'g-caption': ['12px', { lineHeight: '16px' }],
      },
      colors: {
        // Brand — refined indigo (primary actions / selection / state)
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Glib.money (§3.1) — the customer-facing brand. Kept in its own scale
        // so the back-office `brand` indigo is never disturbed.
        glib: {
          blue: '#0257FD',
          grey: '#101214',
          bluegrey: '#EDF1F4',
          700: '#0246CE',
          100: '#E3EDFF',
          600: '#5A6169',
          300: '#C7CDD4',
          ok: '#0F7B4F',
          warn: '#B26A00',
          stop: '#C0271A',
        },
        // Ink — the dark navy nav rail (second neutral layer, cooler)
        ink: {
          950: '#0a0f1c',
          900: '#0d1424',
          850: '#111a2e',
          800: '#16203a',
          700: '#1e2b49',
          600: '#2a3a5f',
          500: '#3a4d76',
          400: '#5b6f9c',
          300: '#8ea0c4',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        'card-hover': '0 2px 4px rgba(15,23,42,0.06), 0 6px 16px rgba(15,23,42,0.10)',
        pop: '0 8px 28px rgba(15,23,42,0.16), 0 2px 6px rgba(15,23,42,0.08)',
        rail: '1px 0 0 rgba(255,255,255,0.04)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      },
      borderRadius: {
        card: '12px',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      keyframes: {
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'modal-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'toast-in': 'toast-in 220ms cubic-bezier(0.25, 1, 0.5, 1)',
        'modal-in': 'modal-in 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        'fade-in': 'fade-in 160ms ease-out',
      },
    },
  },
  plugins: [],
}
