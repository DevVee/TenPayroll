/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{html,ts,tsx}',
    './src/renderer/index.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#4F46E5',
          dark:    '#3730A3',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderColor: {
        'white/8': 'rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
}
