import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        formify: {
          bg: "#FBFBFB",
          primary: "#2149A1",
          "primary-hover": "#1a3a87",
          "primary-light": "#e8eef9",
          gray: "#868C94",
          muted: "#848494",
        },
      },
      keyframes: {
        "slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-right": {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-left": {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "bounce-in": {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "70%": { transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        typing: {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "pulse-wave": {
          "0%, 100%": { transform: "scaleX(1)" },
          "50%": { transform: "scaleX(0.7)" },
        },
        "write-signature": {
          "0%": { width: "0", opacity: "0" },
          "10%": { opacity: "1" },
          "100%": { width: "100%", opacity: "1" },
        },
      },
      animation: {
        "slide-down": "slide-down 0.5s ease-out forwards",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "fade-in-delay": "fade-in 0.6s ease-out 0.2s forwards",
        "fade-up": "fade-up 0.6s ease-out forwards",
        "fade-up-delay": "fade-up 0.6s ease-out 0.3s both",
        "fade-up-delay-2": "fade-up 0.6s ease-out 0.5s both",
        "fade-up-delay-3": "fade-up 0.6s ease-out 0.7s both",
        "fade-up-delay-4": "fade-up 0.6s ease-out 0.9s both",
        "slide-right": "slide-right 0.7s ease-out forwards",
        "slide-left": "slide-left 0.7s ease-out forwards",
        "slide-up": "fade-up 0.6s ease-out forwards",
        "slide-up-delay": "fade-up 0.6s ease-out 0.2s both",
        "bounce-in": "bounce-in 0.5s ease-out forwards",
        "typing-1": "typing 1s steps(10) 0.5s both",
        "typing-2": "typing 1.2s steps(22) 2s both",
        "typing-3": "typing 1s steps(13) 4s both",
        "typing-4": "typing 1.3s steps(26) 6s both",
        "typing-5": "typing 1.2s steps(22) 8s both",
        "cursor-1": "cursor-blink 0.8s 0.5s step-end 15",
        "cursor-2": "cursor-blink 0.8s 2s step-end 15",
        "cursor-3": "cursor-blink 0.8s 4s step-end 12",
        "cursor-4": "cursor-blink 0.8s 6s step-end 16",
        "cursor-5": "cursor-blink 0.8s 8s step-end 15",
        "pulse-wave": "pulse-wave 1.5s ease-in-out infinite",
        "write-signature": "write-signature 2s ease-out 1s both",
        "fade-in-up": "fade-up 0.5s ease-out forwards",
        "fade-in-up-delay": "fade-up 0.5s ease-out 0.15s both",
        "fade-in-up-delay-2": "fade-up 0.5s ease-out 0.3s both",
        "slide-up-delay-2": "fade-up 0.6s ease-out 0.4s both",
        "slide-up-delay-3": "fade-up 0.6s ease-out 0.6s both",
        "slide-up-delay-4": "fade-up 0.6s ease-out 0.8s both",
        "slide-up-delay-5": "fade-up 0.6s ease-out 1s both",
        "fade-in-delay-2": "fade-in 0.6s ease-out 0.4s both",
        "fade-in-delay-3": "fade-in 0.6s ease-out 0.6s both",
      },
    },
  },
  plugins: [],
} satisfies Config;