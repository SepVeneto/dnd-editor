/** @type {import('tailwindcss').Config} */
export default {
  prefix: 'mpd-',
  content: [
    './index.html',
    './lib/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4089ef',
      },
    },
  },
  plugins: [],
}
