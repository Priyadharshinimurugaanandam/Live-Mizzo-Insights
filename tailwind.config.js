/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',  // ← ENABLES DARK MODE
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#00938e',
          600: '#007b77',
        }
      }
    },
  },
  plugins: [],
}