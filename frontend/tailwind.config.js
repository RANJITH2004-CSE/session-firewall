/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bank: {
          50: '#f0f5ff',
          100: '#e5edff',
          200: '#cddbfe',
          300: '#b4c6fc',
          400: '#8da2f8',
          500: '#6379f1',
          600: '#4355e1',
          700: '#313ec6',
          800: '#1e293b',
          900: '#0f172a',
          navy: '#0b192e',
          accent: '#2563eb',
          danger: '#dc2626'
        }
      }
    },
  },
  plugins: [],
}
