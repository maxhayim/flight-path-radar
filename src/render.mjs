// Contribution grid -> animated radar-scope SVG with a plane flying through every contributed day.
import { PLANES, DEFAULT_PLANE } from "./planes.mjs";

const CELL = 11, STEP = 14, MARGIN = 28, ROWS = 7;
const SLOW = 28;              // px per second while hopping between neighbouring targets
const FAST = 240;             // px per second across long gaps
const NEAR = 2 * STEP;        // hops up to this length stay slow
const HOLD = 3;               // pause after the run, seconds
const SWEEP = 4;              // radar sweep period, seconds

const T = {
  bg: "#03140b", grid: "#0f3d22", ring: "#14522d", empty: "#082516",
  levels: ["#082516", "#11532c", "#1c8443", "#2fc062", "#5dff95"],
  sweep: "#3dff7f", lock: "#ffb347", plane: "#0a0d0b", edge: "#5dff95", track: "#5dff95",
};

const center = (c) => [MARGIN + c.col * STEP + CELL / 2, MARGIN + c.row * STEP + CELL / 2];
const f = (n) => +n.toFixed(2);
const r = (n) => +n.toFixed(4);

// Nearest-neighbour route through contributed cells, smoothed with Catmull-Rom.
function routeSegments(cells, cols) {
  const todo = cells.filter((c) => c.level > 0).map(center);
  const midY = MARGIN + 3 * STEP + CELL / 2;
  const route = [[-40, midY]];
  while (todo.length) {
    const last = route[route.length - 1];
    let bi = 0, bd = Infinity;
    todo.forEach((p, i) => { const d = Math.hypot(p[0] - last[0], p[1] - last[1]); if (d < bd) { bd = d; bi = i; } });
    route.push(todo.splice(bi, 1)[0]);
  }
  route.push([MARGIN * 2 + cols * STEP + 40, midY]);
  const segs = [];
  for (let i = 0; i < route.length - 1; i++) {
    const p0 = route[i - 1] || route[i], p1 = route[i], p2 = route[i + 1], p3 = route[i + 2] || p2;
    segs.push({ a: p1,
      c1: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      c2: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p: p2 });
  }
  return segs;
}

function samplePath(segs) {
  const pts = [{ x: segs[0].a[0], y: segs[0].a[1], s: 0 }];
  const bounds = [0];
  let s = 0, prev = segs[0].a;
  for (const g of segs) {
    for (let i = 1; i <= 24; i++) {
      const t = i / 24, u = 1 - t;
      const p = [0, 1].map((k) => u*u*u*g.a[k] + 3*u*u*t*g.c1[k] + 3*u*t*t*g.c2[k] + t*t*t*g.p[k]);
      s += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      pts.push({ x: p[0], y: p[1], s }); prev = p;
    }
    bounds.push(s);
  }
  return { pts, length: s, bounds };
}

const toD = (segs) => `M${segs[0].a.map(f).join(",")}` +
  segs.map((g) => `C${g.c1.map(f).join(",")} ${g.c2.map(f).join(",")} ${g.p.map(f).join(",")}`).join("");

export function buildSvg(cells, { plane = DEFAULT_PLANE } = {}) {
  const craft = PLANES[plane];
  if (!craft) throw new Error(`Unknown plane "${plane}". Choose one of: ${Object.keys(PLANES).join(", ")}`);
  const cols = Math.max(...cells.map((c) => c.col)) + 1;
  const W = MARGIN * 2 + cols * STEP, H = MARGIN * 2 + ROWS * STEP;
  const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy) + 4;
  const segs = routeSegments(cells, cols);
  const { pts, length, bounds } = samplePath(segs);

  // Each hop is slow for its first NEAR px and fast beyond that, eased with a spline on long hops.
  const hopTime = (L) => Math.min(L, NEAR) / SLOW + Math.max(0, L - NEAR) / FAST;
  const times = [0];
  for (let i = 1; i < bounds.length; i++) times.push(times[i - 1] + hopTime(bounds[i] - bounds[i - 1]));
  const fly = times[times.length - 1], dur = fly + HOLD;
  const frac = (s) => {
    let i = 1;
    while (i < bounds.length - 1 && bounds[i] < s) i++;
    const u = (s - bounds[i - 1]) / (bounds[i] - bounds[i - 1] || 1);
    return (times[i - 1] + u * (times[i] - times[i - 1])) / dur;
  };
  const keyTimes = [...times.map((t) => r(t / dur)), 1].join(";");
  const keySplines = [...segs.map((_, i) => bounds[i + 1] - bounds[i] > NEAR * 2 ? "0.5 0 0.5 1" : "0 0 1 1"), "0 0 1 1"].join(";");
  const timing = `keyTimes="${keyTimes}" keySplines="${keySplines}" calcMode="spline" dur="${r(dur)}s" repeatCount="indefinite"`;
  const anim = (attr, values, kt) =>
    `<animate attributeName="${attr}" values="${values}" keyTimes="${kt}" dur="${r(dur)}s" repeatCount="indefinite"/>`;

  const passTime = (c) => {
    const [x, y] = center(c);
    let best = pts[0], bd = Infinity;
    for (const p of pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    return frac(best.s);
  };

  // Scope background: grid lines, range rings, crosshair.
  const scope = [`<rect width="${W}" height="${H}" rx="8" fill="${T.bg}"/>`];
  for (let x = MARGIN - STEP / 2 + STEP * 4; x < W; x += STEP * 4)
    scope.push(`<line x1="${f(x)}" y1="0" x2="${f(x)}" y2="${H}" stroke="${T.grid}" stroke-width="0.5"/>`);
  for (let y = MARGIN - STEP / 2; y <= H; y += STEP * 2)
    scope.push(`<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}" stroke="${T.grid}" stroke-width="0.5"/>`);
  for (let rr = 70; rr < R; rr += 70)
    scope.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${rr}" fill="none" stroke="${T.ring}" stroke-width="0.8" stroke-dasharray="2 3"/>`);
  scope.push(`<line x1="${f(cx)}" y1="0" x2="${f(cx)}" y2="${H}" stroke="${T.ring}" stroke-width="0.8"/>`,
             `<line x1="0" y1="${f(cy)}" x2="${W}" y2="${f(cy)}" stroke="${T.ring}" stroke-width="0.8"/>`);

  // Rotating sweep: a fan of thin wedges fading out behind a bright leading edge.
  const wedges = [];
  for (let i = 0; i < 18; i++) {
    const a0 = (-i * 2.5) * Math.PI / 180, a1 = (-(i + 1) * 2.5) * Math.PI / 180;
    wedges.push(`<path d="M${f(cx)},${f(cy)} L${f(cx + R * Math.cos(a0))},${f(cy + R * Math.sin(a0))} A${f(R)},${f(R)} 0 0 0 ${f(cx + R * Math.cos(a1))},${f(cy + R * Math.sin(a1))} Z" fill="${T.sweep}" opacity="${r(0.16 * (1 - i / 18))}"/>`);
  }
  const sweep = `<g>${wedges.join("")}
    <line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + R)}" y2="${f(cy)}" stroke="${T.sweep}" stroke-width="1.2" opacity="0.8"/>
    <animateTransform attributeName="transform" type="rotate" from="0 ${f(cx)} ${f(cy)}" to="360 ${f(cx)} ${f(cy)}" dur="${SWEEP}s" repeatCount="indefinite"/></g>`;

  // Blips: lit until the plane passes, then a lock-on box and they go dark.
  const blips = [];
  for (const c of cells) {
    const x = MARGIN + c.col * STEP, y = MARGIN + c.row * STEP, [bx, by] = center(c);
    if (c.level === 0) { blips.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${T.empty}"/>`); continue; }
    const col = T.levels[c.level], k = passTime(c), k1 = r(k + 0.001), k2 = Math.min(k + 0.004, 0.98), k3 = Math.min(k + 0.03, 0.985);
    const lockKt = `0;${r(k)};${k1};${r(k3)};1`;
    blips.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${col}"${c.level >= 3 ? ` filter="url(#glow)"` : ""}>` +
      anim("fill", `${col};${col};${T.lock};${T.empty};${T.empty};${col}`, `0;${r(k)};${r(k2)};${r(k3)};0.99;1`) + `</rect>`);
    blips.push(`<rect x="${f(bx - 3)}" y="${f(by - 3)}" width="6" height="6" fill="none" stroke="${T.lock}" stroke-width="1" opacity="0">` +
      anim("opacity", "0;0;1;0;0", lockKt) +
      anim("width", "6;6;6;16;6", lockKt) + anim("height", "6;6;6;16;6", lockKt) +
      anim("x", `${f(bx - 3)};${f(bx - 3)};${f(bx - 3)};${f(bx - 8)};${f(bx - 3)}`, lockKt) +
      anim("y", `${f(by - 3)};${f(by - 3)};${f(by - 3)};${f(by - 8)};${f(by - 3)}`, lockKt) + `</rect>`);
  }

  const d = toD(segs);
  const track = `<path d="${d}" fill="none" stroke="${T.track}" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="1 4" mask="url(#reveal)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>Flight Path: ${craft.name}</title>
<defs>
  <clipPath id="scope"><rect width="${W}" height="${H}" rx="8"/></clipPath>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <mask id="reveal"><path d="${d}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="${f(length)} ${f(length)}" stroke-dashoffset="${f(length)}">
    <animate attributeName="stroke-dashoffset" values="${[...bounds.map((b) => f(length - b)), 0].join(";")}" ${timing}/></path></mask>
</defs>
<g clip-path="url(#scope)">
${scope.join("\n")}
${blips.join("\n")}
${track}
${sweep}
<g opacity="0.92"><g transform="scale(${craft.scale})">${craft.draw(T)}</g>
  <animateMotion path="${d}" rotate="auto" keyPoints="${[...bounds.map((b) => r(b / length)), 1].join(";")}" ${timing}/>
</g>
</g>
</svg>`;
}
