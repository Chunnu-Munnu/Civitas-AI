/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'civitas-navy': '#0A1628',
        'civitas-gold': '#F5A623',
        'civitas-green': '#2ECC71',
      }
    },
  },
  plugins: [],
}
