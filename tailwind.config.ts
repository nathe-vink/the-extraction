import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "neon-green": "#39ff14",
        "neon-pink": "#ff6ec7",
        "neon-blue": "#00f0ff",
        "neon-purple": "#bf00ff",
        "neon-yellow": "#ffff00",
        "neon-orange": "#ff6600",
        "space-dark": "#0a0a1a",
        "space-mid": "#12122a",
        "space-light": "#1a1a3e",
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "pulse-neon": "pulseNeon 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "scan-line": "scanLine 4s linear infinite",
        "glitch": "glitch 0.3s ease-in-out",
        "beam-down": "beamDown 2s ease-out forwards",
        "burn": "burn 3s ease-in forwards",
        "skeleton": "skeleton 1s ease-in forwards",
        "ash": "ash 2s ease-out forwards",
        "ship-arrive": "shipArrive 3s ease-out forwards",
        "ship-depart": "shipDepart 3s ease-in forwards",
        "typing-dot": "typingDot 1.4s ease-in-out infinite",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
      },
      keyframes: {
        pulseNeon: {
          "0%, 100%": { opacity: "1", textShadow: "0 0 10px currentColor, 0 0 20px currentColor" },
          "50%": { opacity: "0.8", textShadow: "0 0 5px currentColor, 0 0 10px currentColor" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        glitch: {
          "0%, 100%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 2px)" },
          "40%": { transform: "translate(-2px, -2px)" },
          "60%": { transform: "translate(2px, 2px)" },
          "80%": { transform: "translate(2px, -2px)" },
        },
        beamDown: {
          "0%": { height: "0%", opacity: "0.5" },
          "100%": { height: "100%", opacity: "1" },
        },
        burn: {
          "0%": { filter: "brightness(1) hue-rotate(0deg)" },
          "30%": { filter: "brightness(2) hue-rotate(30deg)", color: "#ff4400" },
          "60%": { filter: "brightness(3) hue-rotate(60deg)", color: "#ff8800" },
          "100%": { filter: "brightness(0.3) hue-rotate(0deg)", opacity: "0.3" },
        },
        skeleton: {
          "0%": { opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { opacity: "1" },
        },
        ash: {
          "0%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.8)" },
          "100%": { opacity: "0", transform: "scale(0) translateY(20px)" },
        },
        shipArrive: {
          "0%": { transform: "translateY(-200%) scale(0.3)", opacity: "0" },
          "60%": { transform: "translateY(10%) scale(1.1)", opacity: "1" },
          "100%": { transform: "translateY(0%) scale(1)", opacity: "1" },
        },
        shipDepart: {
          "0%": { transform: "translateY(0%) scale(1)", opacity: "1" },
          "40%": { transform: "translateY(-10%) scale(1.1)", opacity: "1" },
          "100%": { transform: "translateY(-200%) scale(0.3)", opacity: "0" },
        },
        typingDot: {
          "0%, 60%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "30%": { opacity: "1", transform: "scale(1)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
