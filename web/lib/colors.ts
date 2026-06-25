// Centralized color constants. Monotone palette + exactly three semantic colors:
// one near-black accent, one muted "up" green, one muted "down" red.
// Reuse these everywhere (charts especially) so nothing rainbows.

export const colors = {
  gray950: "#0A0A0A",
  gray700: "#404040",
  gray500: "#737373",
  gray400: "#A3A3A3",
  gray300: "#D4D4D4",
  gray200: "#E5E5E5",
  gray100: "#F5F5F5",
  white: "#FFFFFF",

  accent: "#0A0A0A",
  up: "#4D7C5A",
  down: "#A14B4B",
} as const;

// Grayscale-weighted series colors for multi-line charts (no rainbow).
// Index 0 is the strongest (accent), the rest step down in weight.
export const seriesColors = [
  colors.gray950,
  colors.gray500,
  colors.gray400,
  colors.gray300,
  colors.gray700,
] as const;
