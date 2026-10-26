/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Source Serif 4', 'ui-serif', 'Georgia', 'serif'],
      },
      keyframes: {
        indeterminate: {
          '0%': { left: '-40%' },
          '100%': { left: '100%' },
        },
      },
      animation: {
        indeterminate: 'indeterminate 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
