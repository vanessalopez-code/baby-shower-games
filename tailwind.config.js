/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage:    { DEFAULT: '#6B9B76', mid: '#8FB99A', light: '#C4DAC8', pale: '#EDF4EF' },
        skyblue: { DEFAULT: '#7AAFC4', light: '#B8D7E5', pale: '#E8F3F8' },
        wood:    { DEFAULT: '#7A5C3A', mid: '#A07850', light: '#C9A87A', pale: '#F5EDE0' },
        canvas:  '#F7F5F1',
      },
    },
  },
  plugins: [],
}
