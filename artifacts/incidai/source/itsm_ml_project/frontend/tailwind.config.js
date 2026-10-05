/** @type {import("tailwindcss").Config} */
import forms from "@tailwindcss/forms";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        mint: "#3EB489",
        lavender: "#C7B3FF",
        coral: "#FFB7A7",
        sunshine: "#FFE38A",
        slate: "#2F3A3A"
      },
      fontFamily: {
        display: ["Poppins", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glass: "0 10px 30px rgba(46, 87, 87, 0.15)",
        glow: "0 0 0 1px rgba(255, 255, 255, 0.4), 0 8px 24px rgba(62, 180, 137, 0.25)"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: [forms]
};
