/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        storm: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b9dfff',
          300: '#7cc5ff',
          400: '#36a8ff',
          500: '#0c8af0',
          600: '#006dcd',
          700: '#0057a6',
          800: '#004a89',
          900: '#003d71',
          950: '#00274a',
        },
        tempest: {
          50: '#eef3ff',
          100: '#dce7ff',
          200: '#bfd3ff',
          300: '#92b6ff',
          400: '#5c8cff',
          500: '#3a67f7',
          600: '#2c4ed1',
          700: '#243da6',
          800: '#213685',
          900: '#1f2f6a',
          950: '#0d1429',
        },
      },
      animation: {
        'roll-appear': 'roll-appear 0.3s ease-out',
      },
      keyframes: {
        'roll-appear': {
          '0%': {
            transform: 'scale(0.8)',
            opacity: '0',
            boxShadow: '0 0 20px rgba(92, 140, 255, 0.5)',
          },
          '50%': {
            transform: 'scale(1.05)',
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '1',
            boxShadow: 'none',
          },
        },
      },
    },
  },
  plugins: [],
};
