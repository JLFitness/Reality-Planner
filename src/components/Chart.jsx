// Tiny hand-rolled SVG charts (no chart library — restraint). Colours come from the
// theme via CSS variables so they follow the accent.

// Bars with a faint full-height "column" track behind each, rounded tops, value
// labels, and a dashed 100% reference line (the mandatory baseline) when relevant.
export default function BarChart({ data, max = 150, unit = '%', accent = 'rgb(var(--a-400))' }) {
  if (!data.length) return null;
  const W = 340;
  const H = 150;
  const pad = { top: 16, bottom: 26, left: 6, right: 6 };
  const plotH = H - pad.top - pad.bottom;
  const n = data.length;
  const gap = n > 8 ? 5 : 8;
  const bw = (W - pad.left - pad.right - gap * (n - 1)) / n;
  const radius = Math.min(5, bw / 2);
  const refY = pad.top + plotH * (1 - Math.min(max, 100) / max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {max >= 100 && (
        <>
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={refY}
            y2={refY}
            stroke="#fbbf24"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />
          <text x={W - pad.right} y={refY - 3} textAnchor="end" className="fill-amber-400/70" fontSize="8">
            100
          </text>
        </>
      )}
      {data.map((d, i) => {
        const v = Math.max(0, Math.min(max, d.value));
        const h = (v / max) * plotH;
        const x = pad.left + i * (bw + gap);
        const yTop = pad.top + plotH - h;
        return (
          <g key={i}>
            {/* column track */}
            <rect x={x} y={pad.top} width={bw} height={plotH} rx={radius} fill="rgb(var(--s-800))" opacity="0.5" />
            {/* value bar */}
            {v > 0 && (
              <rect
                x={x}
                y={yTop}
                width={bw}
                height={Math.max(2, h)}
                rx={radius}
                fill={d.muted ? 'rgb(var(--s-600))' : accent}
              />
            )}
            {d.value > 0 && (
              <text x={x + bw / 2} y={yTop - 4} textAnchor="middle" className="fill-slate-300" fontSize="9">
                {d.value}
                {unit}
              </text>
            )}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="fill-slate-500" fontSize={n > 8 ? 8 : 9}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Line for values in a narrow band (e.g. body weight). Auto-scales to min/max,
// fills a soft gradient under the line, and breaks the line across gaps.
export function LineChart({ data, unit = '', accent = 'rgb(var(--a-400))' }) {
  const present = data.map((d, i) => ({ ...d, i })).filter((d) => typeof d.value === 'number');
  if (present.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No weight logged yet.</p>;
  }

  const W = 340;
  const H = 140;
  const m = { t: 18, b: 24, l: 8, r: 8 };
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  const n = data.length;
  const baseY = m.t + plotH;

  const vals = present.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const lo = min - span * 0.25;
  const hi = max + span * 0.25;

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

  const gid = `weightfill-${present.length}-${Math.round(min)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {segments.map((seg, si) => {
        const line = seg.map((p) => `${x(p.i)},${y(p.v)}`).join(' ');
        const area = `${x(seg[0].i)},${baseY} ${line} ${x(seg[seg.length - 1].i)},${baseY}`;
        return (
          <g key={si}>
            {seg.length > 1 && <polygon points={area} fill={`url(#${gid})`} />}
            <polyline
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={line}
            />
          </g>
        );
      })}
      {present.map((d) => (
        <circle key={d.i} cx={x(d.i)} cy={y(d.value)} r="2.5" fill={accent} />
      ))}
      {[present[0], present[present.length - 1]].map((d, k) => (
        <text key={k} x={x(d.i)} y={y(d.value) - 6} textAnchor="middle" className="fill-slate-300" fontSize="9">
          {d.value}
          {unit}
        </text>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 7} textAnchor="middle" className="fill-slate-500" fontSize={n > 8 ? 8 : 9}>
          {d.label}
        </text>
      ))}
    </svg>
  );
}
