/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5bcfc',
          400: '#8198f8',
          500: '#6172f3',
          600: '#4c4de8',
          700: '#3e3bcf',
          800: '#3433a8',
          900: '#2f3085',
          950: '#1c1d4e',
        },
        dark: {
          900: '#0d0d14',
          800: '#12121f',
          700: '#1a1a2e',
          600: '#212135',
          500: '#2a2a45',
          400: '#363656',
          300: '#4a4a6a',
          200: '#5e5e80',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
