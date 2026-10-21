#!/usr/bin/env node
// Usage: node src/cli.mjs <github_user> <output.svg[?plane=b2]> [more outputs...]
// Reads GITHUB_TOKEN from the environment when set.
import fs from "node:fs";
import path from "node:path";
import { getGrid } from "./grid.mjs";
import { buildSvg } from "./render.mjs";
import { DEFAULT_PLANE } from "./planes.mjs";

const [user, ...outputs] = process.argv.slice(2).flatMap((a) => a.split("\n")).map((a) => a.trim()).filter(Boolean);
if (!user || !outputs.length) {
  console.error("Usage: node src/cli.mjs <github_user> <output.svg[?plane=b2]> [more outputs...]");
  process.exit(1);
}

const cells = await getGrid(user, process.env.GITHUB_TOKEN);
console.log(`${user}: ${cells.length} days, ${cells.filter((c) => c.level).length} with contributions`);

for (const out of outputs) {
  const [file, query = ""] = out.split("?");
  const plane = new URLSearchParams(query).get("plane") || process.env.FLIGHT_PATH_PLANE || DEFAULT_PLANE;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, buildSvg(cells, { plane }));
  console.log(`wrote ${file} (${plane})`);
}
