export const tokens = {
  colors: {
    primary: "#6D7EF7",
    primarySoft: "#EEF0FF",
    secondary: "#61CBB5",
    secondarySoft: "#E9F9F4",
    accent: "#FFBFA3",
    bg: "#F7F8FC",
    surface: "#FCFCFF",
    surface2: "#F3F4FA",
    border: "#E4E7F2",
    text: "#1C2240",
    muted: "#6E7693",
    success: "#8BD7B7",
    warning: "#FFD9A3",
    danger: "#FFB2BC",
    focusRing: "#6D7EF7",
  },
  radius: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    "2xl": "1.25rem",
  },
  shadows: {
    xs: "0 1px 2px rgba(28, 34, 64, 0.05)",
    sm: "0 6px 18px rgba(34, 44, 92, 0.08)",
    md: "0 16px 36px rgba(34, 44, 92, 0.12)",
  },
  transitions: {
    fast: "150ms",
    normal: "250ms",
    easing: "ease-out",
  },
  layout: {
    maxWidth: "1360px",
    sidebarWidth: "17.5rem",
    topbarHeight: "4.5rem",
  },
} as const;

export type DesignTokens = typeof tokens;
