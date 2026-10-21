#!/usr/bin/env node
// Usage: node src/cli.mjs [--year YYYY | --from YYYY-MM-DD --to YYYY-MM-DD] <github_user> <output.svg[?plane=b2&theme=cockpit]> [more outputs...]
// Reads GITHUB_TOKEN from the environment when set.
import fs from "node:fs";
import path from "node:path";
import { getGrid, resolveRange } from "./grid.mjs";
import { buildSvg, DEFAULT_THEME } from "./render.mjs";
import { DEFAULT_PLANE } from "./planes.mjs";

const USAGE = "Usage: node src/cli.mjs [--year YYYY | --from YYYY-MM-DD --to YYYY-MM-DD] <github_user> <output.svg[?plane=b2&theme=cockpit]> [more outputs...]";

// --year/--from/--to flags, falling back to FLIGHT_PATH_YEAR/FROM/TO (set by the Action).
const opts = { year: process.env.FLIGHT_PATH_YEAR, from: process.env.FLIGHT_PATH_FROM, to: process.env.FLIGHT_PATH_TO };
const args = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const m = argv[i].match(/^--(year|from|to)(?:=(.*))?$/);
  if (m) opts[m[1]] = m[2] ?? argv[++i];
  else args.push(argv[i]);
}

const [user, ...outputs] = args.flatMap((a) => a.split("\n")).map((a) => a.trim()).filter(Boolean);
if (!user || !outputs.length) {
  console.error(USAGE);
  process.exit(1);
}

let range, cells;
try {
  range = resolveRange({ year: opts.year?.trim(), from: opts.from?.trim(), to: opts.to?.trim() });
  cells = await getGrid(user, process.env.GITHUB_TOKEN, range);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
const span = range ? ` from ${range.from} to ${range.to}` : "";
console.log(`${user}${span}: ${cells.length} days, ${cells.filter((c) => c.level).length} with contributions`);

for (const out of outputs) {
  const [file, query = ""] = out.split("?");
  const params = new URLSearchParams(query);
  const plane = params.get("plane") || process.env.FLIGHT_PATH_PLANE || DEFAULT_PLANE;
  const theme = params.get("theme") || process.env.FLIGHT_PATH_THEME || DEFAULT_THEME;
  let svg;
  try {
    svg = buildSvg(cells, { plane, theme, user, range });
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, svg);
  console.log(`wrote ${file} (${plane}, ${theme})`);
}
