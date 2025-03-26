/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        roboto: ["Roboto", "sans-serif"],
      },
      colors: {
        primary: "#2093ff",
        background: "#f0f4f8",
        gradient: {
          start: "#24b3ec",
          middle: "#b9f9fb",
          end: "#dcfb6c",
        },
      },
    },
  },
  plugins: [],
};
