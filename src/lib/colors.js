// One calm, dark-mode-friendly colour per category, used everywhere (timeline
// blocks, day bars, task list). Colours are stored on each priority so they stay
// stable when the list is reordered; this palette is the fallback / seed order.
export const PALETTE = [
  '#818cf8', // indigo
  '#fbbf24', // amber
  '#22d3ee', // cyan
  '#60a5fa', // blue
  '#34d399', // emerald
  '#fb7185', // rose
  '#a78bfa', // violet
  '#f97316', // orange
  '#2dd4bf', // teal
  '#94a3b8', // slate
];

export const FIXED_COLOR = '#64748b'; // commitments (no category)

export function colorForIndex(i) {
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

export function categoryColor(priorities, categoryId) {
  const i = priorities.findIndex((p) => p.id === categoryId);
  if (i < 0) return FIXED_COLOR;
  return priorities[i].color || colorForIndex(i);
}

// Subtle translucent fill of a hex colour for block backgrounds.
export function tint(hex, alpha = 0.22) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
