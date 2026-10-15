/** Verdict tone palette shared by the journey dashboards (pills, KPI values, distribution bar). */
export const TONE_COLORS = {
  good: "#16a34a",
  info: "#0891b2",
  warn: "#f59e0b",
  "warn-deep": "#c2410c",
  purple: "#7c3aed",
  bad: "#ef4444",
  neutral: "#64748b",
};

export const toneColor = (tone) => TONE_COLORS[tone] ?? TONE_COLORS.neutral;
