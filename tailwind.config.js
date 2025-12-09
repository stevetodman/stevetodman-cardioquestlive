/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "cardio-blue": "#0f172a",
        "cardio-accent": "#38bdf8",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shake: "shake 0.3s ease-in-out",
        "shimmer": "shimmer 1.5s linear infinite",
        "correct-pulse": "correct-pulse 0.3s ease-out 1",
        "select-pop": "select-pop 0.2s ease-out 1",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "correct-pulse": {
          "0%": { transform: "scale(0.98)" },
          "50%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
        "select-pop": {
          "0%": { transform: "scale(0.98)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
}
