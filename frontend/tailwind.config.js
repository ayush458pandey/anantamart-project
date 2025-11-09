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
      },
    },
  },
  plugins: [],
}
