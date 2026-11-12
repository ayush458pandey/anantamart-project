/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00a86b',
        'primary-dark': '#008f5a',
        secondary: '#f3f4f6',
        app: '#a9bdd9',
        'app-dark': '#93a9c9',
      },
    },
  },
  plugins: [],
}
