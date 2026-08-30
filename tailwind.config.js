/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#f97316',
          orangeDark: '#ea580c',
          orangeLight: '#fdba74',
          darkBg: '#0f1117',
          darkCard: '#181b24',
          darkBorder: '#272b38',
          blueBg: '#0b132b',
          blueCard: '#1c2541',
          blueBorder: '#3a506b',
          blueAccent: '#00b4d8',
        }
      }
    },
  },
  plugins: [],
}
