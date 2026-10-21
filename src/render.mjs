// Contribution grid -> animated radar-scope SVG with a plane flying through every contributed day.
// Themes: "radar" (the scope on its own) or "cockpit" (the scope framed to match Cockpit Telemetry).
import { PLANES, DEFAULT_PLANE } from "./planes.mjs";

const CELL = 11, STEP = 14, MARGIN = 28, ROWS = 7;
const SLOW = 28;              // px per second while hopping between neighbouring targets
const FAST = 240;             // px per second across long gaps
const NEAR = 2 * STEP;        // hops up to this length stay slow
const HOLD = 3;               // pause after the run, seconds
const SWEEP = 4;              // radar sweep period, seconds

export const THEMES = {
  radar: {
    bg: "#03140b", grid: "#0f3d22", ring: "#14522d", empty: "#082516",
    levels: ["#082516", "#11532c", "#1c8443", "#2fc062", "#5dff95"],
    sweep: "#3dff7f", lock: "#ffb347", plane: "#0a0d0b", edge: "#5dff95", track: "#5dff95",
  },
  // Cockpit Telemetry's palette: the scope is a display set into a bezel panel.
  cockpit: {
    bg: "#020d07", grid: "#0f3d22", ring: "#14522d", empty: "#0b3a1f",
    levels: ["#0b3a1f", "#14522d", "#1c8443", "#2fc062", "#5dff95"],
    sweep: "#5dff95", lock: "#ffb347", plane: "#0a0d0b", edge: "#5dff95", track: "#5dff95",
    frame: "#020d07", panel: "#03140b", border: "#14522d", text: "#5dff95", dim: "#2fc062", lit: "#0b3a1f",
  },
};
export const DEFAULT_THEME = "radar";

// Cockpit Telemetry layout constants: 960px canvas, 16px gutters, 10px canvas and 6px panel corners.
const COCKPIT_W = 960, GUTTER = 16, FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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

export function buildSvg(cells, { plane = DEFAULT_PLANE, theme = DEFAULT_THEME, user = "", range = null } = {}) {
  const craft = PLANES[plane];
  if (!craft) throw new Error(`Unknown plane "${plane}". Choose one of: ${Object.keys(PLANES).join(", ")}`);
  const T = THEMES[theme];
  if (!T) throw new Error(`Unknown theme "${theme}". Choose one of: ${Object.keys(THEMES).join(", ")}`);
  const cockpit = theme === "cockpit";
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

  // In the cockpit frame the scope is scaled to fill the panel; keep its corners at 4px on screen.
  const scale = cockpit ? (COCKPIT_W - GUTTER * 2 - 24) / W : 1;
  const scopeRx = f((cockpit ? 4 : 8) / scale);

  const passTime = (c) => {
    const [x, y] = center(c);
    let best = pts[0], bd = Infinity;
    for (const p of pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    return frac(best.s);
  };

  // Scope background: grid lines, range rings, crosshair.
  const scope = [`<rect width="${W}" height="${H}" rx="${scopeRx}" fill="${T.bg}"/>`];
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

  const defs = `<defs>
  <clipPath id="scope"><rect width="${W}" height="${H}" rx="${scopeRx}"/></clipPath>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <mask id="reveal"><path d="${d}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="${f(length)} ${f(length)}" stroke-dashoffset="${f(length)}">
    <animate attributeName="stroke-dashoffset" values="${[...bounds.map((b) => f(length - b)), 0].join(";")}" ${timing}/></path></mask>
</defs>`;
  const body = `<g clip-path="url(#scope)">
${scope.join("\n")}
${blips.join("\n")}
${track}
${sweep}
<g opacity="0.92"><g transform="scale(${craft.scale})">${craft.draw(T)}</g>
  <animateMotion path="${d}" rotate="auto" keyPoints="${[...bounds.map((b) => r(b / length)), 1].join(";")}" ${timing}/>
</g>
</g>`;

  if (!cockpit) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>Flight Path Radar: ${craft.name}</title>
${defs}
${body}
</svg>`;

  const targets = cells.filter((c) => c.level > 0).length;
  const span = range ? (range.from.endsWith("-01-01") && range.to === `${range.from.slice(0, 4)}-12-31` ? range.from.slice(0, 4) : `${range.from} TO ${range.to}`) : "LAST 12 MONTHS";
  return cockpitFrame(T, { defs, body, scale, W, H, user, span, craft, targets, days: cells.length, loop: Math.round(dur) });
}

const text = (x, y, s, { size = 11, fill, anchor = "start", weight = "", extra = "", children = "" }) =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"` +
  `${weight ? ` font-weight="${weight}"` : ""}${extra}>${esc(s)}${children}</text>`;

// Header, bezel panel with corner brackets and an annunciator strip, laid out like Cockpit Telemetry.
function cockpitFrame(T, { defs, body, scale, W, H, user, span, craft, targets, days, loop }) {
  const px = GUTTER, py = 56, pw = COCKPIT_W - GUTTER * 2, ph = 26 + H * scale + 12;
  const ay = py + ph + 10, CH = ay + 20 + GUTTER;
  const b = 10, c = (x, y, dx, dy) => `M${x + dx * b},${y}L${x},${y}L${x},${y + dy * b}`;
  const lamps = [["RADAR ACTIVE", true], [`TGT ${targets}`, false], [`CRAFT ${craft.name.toUpperCase()}`, false],
    [`DAYS ${days}`, false], [`LOOP ${loop}S`, false]];
  let lx = GUTTER;
  const strip = lamps.map(([l, lit]) => {
    const w = l.length * 6.6 + 18;
    const g = `<rect x="${f(lx)}" y="${f(ay)}" width="${f(w)}" height="20" rx="3" fill="${lit ? T.lit : T.panel}" stroke="${lit ? T.text : T.border}"/>` +
      text(lx + w / 2, ay + 14, l, { size: 10, anchor: "middle", fill: lit ? T.text : T.dim, weight: lit ? 700 : "",
        children: lit ? `<animate attributeName="opacity" values="1;0.55;1" dur="2.4s" repeatCount="indefinite"/>` : "" });
    lx += w + 8;
    return g;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COCKPIT_W} ${f(CH)}" width="${COCKPIT_W}" height="${f(CH)}" font-family="${FONT}">
<title>Flight Path Radar: ${esc(user)}</title>
<rect width="${COCKPIT_W}" height="${f(CH)}" rx="10" fill="${T.frame}"/>
${text(GUTTER, 34, "FLIGHT PATH RADAR", { size: 18, fill: T.text, weight: 700, extra: ` letter-spacing="3"` })}
${user ? text(286, 34, `CALLSIGN ${user.toUpperCase()}`, { size: 11, fill: T.lock, extra: ` letter-spacing="1.5"` }) : ""}
${text(COCKPIT_W - GUTTER, 34, span, { size: 14, fill: T.text, anchor: "end" })}
<line x1="${GUTTER}" y1="46" x2="${COCKPIT_W - GUTTER}" y2="46" stroke="${T.border}"/>
<rect x="${px}" y="${py}" width="${pw}" height="${f(ph)}" rx="6" fill="${T.panel}" stroke="${T.border}"/>
<path d="${c(px, py, 1, 1)}${c(px + pw, py, -1, 1)}${c(px, py + ph, 1, -1)}${c(px + pw, py + ph, -1, -1)}" fill="none" stroke="${T.dim}" stroke-width="1.5"/>
${text(px + 12, py + 16, "TACTICAL RADAR", { size: 10, fill: T.dim, weight: 700, extra: ` letter-spacing="1.5"` })}
<g transform="translate(${px + 12} ${py + 26}) scale(${r(scale)})">
${defs}
${body}
</g>
${strip}
</svg>`;
}
