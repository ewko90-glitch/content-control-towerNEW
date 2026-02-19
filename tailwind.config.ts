import type { Config } from "tailwindcss";

import { tokens } from "./src/styles/design-tokens.ts";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": tokens.layout.maxWidth,
      },
    },
    extend: {
      colors: {
        ...tokens.colors,
      },
      borderRadius: {
        ...tokens.radius,
      },
      boxShadow: {
        ...tokens.shadows,
      },
      transitionDuration: {
        fast: tokens.transitions.fast,
        normal: tokens.transitions.normal,
      },
      transitionTimingFunction: {
        base: tokens.transitions.easing,
      },
      spacing: {
        sidebar: tokens.layout.sidebarWidth,
        topbar: tokens.layout.topbarHeight,
      },
      maxWidth: {
        app: tokens.layout.maxWidth,
      },
    },
  },
  darkMode: ["class"],
  plugins: [],
};

export default config;
