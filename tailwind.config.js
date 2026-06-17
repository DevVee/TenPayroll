/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    borderRadius: {
      none:    '0px',
      sm:      '6px',
      DEFAULT: '10px',
      md:      '14px',
      lg:      '18px',
      xl:      '24px',
      '2xl':   '32px',
      '3xl':   '40px',
      full:    '9999px',
    },
    extend: {
      colors: {
        brand:         '#5B5FC7',
        'brand-dark':  '#4A4DB4',
        'brand-light': '#EEEEFF',
        'brand-pale':  '#C5C7F4',
        rail:          '#111424',
        surface:       '#F4F5FB',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs:    ['12px', '18px'],
        sm:    ['13px', '20px'],
        base:  ['14px', '22px'],
        md:    ['15px', '24px'],
        lg:    ['16px', '26px'],
        xl:    ['18px', '28px'],
        '2xl': ['20px', '30px'],
        '3xl': ['24px', '34px'],
        '4xl': ['28px', '38px'],
      },
      boxShadow: {
        xs:           '0 1px 2px rgba(27,29,46,0.04)',
        panel:        '0 0 0 1px rgba(27,29,46,0.05), 0 2px 8px rgba(27,29,46,0.06)',
        card:         '0 0 0 1px rgba(27,29,46,0.05), 0 2px 8px rgba(27,29,46,0.06)',
        elevated:     '0 0 0 1px rgba(27,29,46,0.04), 0 4px 16px rgba(27,29,46,0.08)',
        lg:           '0 0 0 1px rgba(27,29,46,0.04), 0 8px 32px rgba(27,29,46,0.10)',
        modal:        '0 20px 60px rgba(27,29,46,0.22), 0 0 0 1px rgba(27,29,46,0.06)',
        dropdown:     '0 4px 20px rgba(27,29,46,0.12), 0 0 0 1px rgba(27,29,46,0.06)',
        glow:         '0 0 0 3px rgba(91,95,199,0.2)',
        'brand-glow': '0 4px 14px rgba(91,95,199,0.4)',
      },
      maxWidth: {
        content: '1400px',
      },
      keyframes: {
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'shrink': {
          from: { width: '100%' },
          to:   { width: '0%' },
        },
        'shimmer': {
          from: { backgroundPosition: '200% 0' },
          to:   { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'slide-up':   'slide-up 0.2s ease-out',
        'fade-in':    'fade-in 0.15s ease-out',
        'page-enter': 'page-enter 0.2s ease-out',
        'shrink':     'shrink 5s linear forwards',
        'shimmer':    'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
}
