// Central remap for face-button labels.
// User's controller labels A/B/X/Y as 1(green)/2(red)/3(blue)/4(pink).
// We render that scheme everywhere instead of A/B/X/Y/O.

export interface PadLabelInfo {
  text: string;
  bg?: string; // chip background color override
}

const FACE_MAP: Record<string, { text: string; bg: string }> = {
  A: { text: '1', bg: '#22c55e' }, // green
  B: { text: '2', bg: '#ef4444' }, // red
  X: { text: '3', bg: '#3b82f6' }, // blue
  Y: { text: '4', bg: '#ec4899' }, // pink
  O: { text: '4', bg: '#ec4899' }, // some pads label Y as O
};

export function remapPadLabel(label: string): PadLabelInfo {
  if (!label) return { text: label };
  const first = label[0]?.toUpperCase();
  const rest = label.slice(1);
  const m = FACE_MAP[first];
  if (m) return { text: m.text + rest, bg: m.bg };
  return { text: label };
}
