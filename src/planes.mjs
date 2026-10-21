// Top-down plane silhouettes pointing along +x, centred on the origin.
// Each one is drawn in the scope palette: dark body, phosphor-green edge.

const body = (d, t, extra = "") =>
  `<path d="${d}" fill="${t.plane}" stroke="${t.edge}" stroke-width="0.7" stroke-opacity="0.75" stroke-linejoin="round"${extra}/>`;
const detail = (d, t, opacity = 0.18) => `<path d="${d}" fill="${t.edge}" opacity="${opacity}"/>`;
const line = (d, t, opacity = 0.35) =>
  `<path d="${d}" fill="none" stroke="${t.edge}" stroke-width="0.5" opacity="${opacity}"/>`;

export const PLANES = {
  // B-2 Spirit: flying wing with a sawtooth trailing edge.
  b2: {
    name: "B-2 Spirit",
    scale: 0.85,
    draw: (t) =>
      body("M9,0 L-3,13 L-6,10.5 L-3,7 L-6,3.5 L-4,0 L-6,-3.5 L-3,-7 L-6,-10.5 L-3,-13 Z", t) +
      detail("M6,0 L0,-2.2 L-2,0 L0,2.2 Z", t),
  },

  // F-117 Nighthawk: faceted arrowhead with a notched tail.
  f117: {
    name: "F-117 Nighthawk",
    scale: 0.9,
    draw: (t) =>
      body("M11,0 L-5,-10 L-7,-8.5 L-4,-3 L-8,-3.5 L-7,0 L-8,3.5 L-4,3 L-7,8.5 L-5,10 Z", t) +
      line("M11,0 L-4,-3 M11,0 L-4,3 M5,0 L-7,0", t) +
      detail("M8,0 L4,-1.4 L3,0 L4,1.4 Z", t, 0.25),
  },

  // F-22 Raptor: diamond wings, angled tailplanes.
  f22: {
    name: "F-22 Raptor",
    scale: 0.85,
    draw: (t) =>
      body("M12,0 L6,-1.8 L1,-2.4 L-3,-9.5 L-6,-9.5 L-5,-2.6 L-8,-2.6 L-10,-6 L-11.5,-6 L-11,-1.5 " +
           "L-11,1.5 L-11.5,6 L-10,6 L-8,2.6 L-5,2.6 L-6,9.5 L-3,9.5 L1,2.4 L6,1.8 Z", t) +
      detail("M9,0 L5,-1 L4,0 L5,1 Z", t, 0.3),
  },

  // SR-71 Blackbird: long chined fuselage, delta wing, two engine nacelles.
  sr71: {
    name: "SR-71 Blackbird",
    scale: 0.8,
    draw: (t) =>
      body("M15,0 C9,-0.8 4,-1.4 -1,-2.6 L-6,-9 L-10,-9 L-9.5,-2 L-11,-1.2 L-11,1.2 L-9.5,2 L-10,9 L-6,9 L-1,2.6 C4,1.4 9,0.8 15,0 Z", t) +
      body("M3,-5.3 L-11,-5.3 L-11,-3.7 L3,-3.7 Z", t) +
      body("M3,5.3 L-11,5.3 L-11,3.7 L3,3.7 Z", t) +
      detail("M10,0 L6,-0.8 L5,0 L6,0.8 Z", t, 0.3),
  },

  // Biplane: two stacked wings and a spinning propeller, for something slower.
  biplane: {
    name: "Biplane",
    scale: 0.9,
    draw: (t) =>
      body("M-2,-11 L3,-11 L3,11 L-2,11 Z", t) +
      line("M0.5,-10 L0.5,10 M-1,-6 L2,-6 M-1,6 L2,6", t, 0.4) +
      body("M-10,-4 L-7,-4 L-7,4 L-10,4 Z", t) +
      body("M-10,0 C-10,-1.4 -4,-1.8 4,-1.8 C7,-1.8 8,-1 8,0 C8,1 7,1.8 4,1.8 C-4,1.8 -10,1.4 -10,0 Z", t) +
      `<line x1="8.8" y1="-3.5" x2="8.8" y2="3.5" stroke="${t.edge}" stroke-width="0.8" opacity="0.6">` +
      `<animateTransform attributeName="transform" type="rotate" values="0 8.8 0;180 8.8 0" dur="0.12s" repeatCount="indefinite"/></line>`,
  },
};

export const DEFAULT_PLANE = "b2";
