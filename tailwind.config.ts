import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef9ec',
          100: '#fdefc9',
          200: '#fbdc8f',
          300: '#f9c54d',
          400: '#f7aa1e',
          500: '#f08c0a',
          600: '#d46806',
          700: '#b04a09',
          800: '#8f390e',
          900: '#762f0f',
        },
        sidebar: '#1a1f2e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
