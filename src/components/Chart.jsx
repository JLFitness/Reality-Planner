// Tiny hand-rolled SVG bar chart (no chart library — restraint). Values 0..max.
export default function BarChart({ data, max = 150, unit = '%', accent = '#34d399' }) {
  if (!data.length) return null;
  const W = 320;
  const H = 140;
  const pad = { top: 10, bottom: 24, left: 4, right: 4 };
  const plotH = H - pad.top - pad.bottom;
  const n = data.length;
  const gap = 8;
  const bw = (W - pad.left - pad.right - gap * (n - 1)) / n;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {/* 100% reference line (the floor) */}
      {max >= 100 && (
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + plotH * (1 - 100 / max)}
          y2={pad.top + plotH * (1 - 100 / max)}
          stroke="#fbbf24"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.6"
        />
      )}
      {data.map((d, i) => {
        const v = Math.max(0, Math.min(max, d.value));
        const h = (v / max) * plotH;
        const x = pad.left + i * (bw + gap);
        const y = pad.top + plotH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={bw}
              height={Math.max(2, h)}
              rx="3"
              fill={d.muted ? '#475569' : accent}
            />
            <text x={x + bw / 2} y={y - 3} textAnchor="middle" className="fill-slate-300" fontSize="9">
              {d.value > 0 ? `${d.value}${unit}` : ''}
            </text>
            <text
              x={x + bw / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="9"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Line chart for values that sit in a narrow band (e.g. body weight). Auto-scales
// to the min/max of present values; null values are gaps.
export function LineChart({ data, unit = '', accent = '#38bdf8' }) {
  const present = data.map((d, i) => ({ ...d, i })).filter((d) => typeof d.value === 'number');
  if (present.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No weight logged yet.</p>;
  }

  const W = 320;
  const H = 130;
  const m = { t: 16, b: 22, l: 6, r: 6 };
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  const n = data.length;

  const vals = present.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const lo = min - span * 0.2;
  const hi = max + span * 0.2;

  const x = (i) => m.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => m.t + plotH * (1 - (v - lo) / (hi - lo));

  // Connect consecutive present points; a gap breaks the line.
  const segments = [];
  let run = [];
  for (let i = 0; i < data.length; i += 1) {
    if (typeof data[i].value === 'number') run.push({ i, v: data[i].value });
    else if (run.length) {
      segments.push(run);
      run = [];
    }
  }
  if (run.length) segments.push(run);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {segments.map((seg, si) => (
        <polyline
          key={si}
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={seg.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
        />
      ))}
      {present.map((d) => (
        <g key={d.i}>
          <circle cx={x(d.i)} cy={y(d.value)} r="2.5" fill={accent} />
        </g>
      ))}
      {/* label first & last present values */}
      {[present[0], present[present.length - 1]].map((d, k) => (
        <text
          key={k}
          x={x(d.i)}
          y={y(d.value) - 6}
          textAnchor="middle"
          className="fill-slate-300"
          fontSize="9"
        >
          {d.value}
          {unit}
        </text>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 7} textAnchor="middle" className="fill-slate-500" fontSize="8">
          {d.label}
        </text>
      ))}
    </svg>
  );
}
