// Fetch a user's contribution calendar as [{ date, row, col, level }].
// Uses the GraphQL API when a token is available, otherwise the public contributions page.
// An optional { from, to } range (YYYY-MM-DD) picks a calendar year or custom window instead of the last year.

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const QUERY = `query($login: String!, $from: DateTime, $to: DateTime) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar { weeks { contributionDays { date weekday contributionLevel } } }
    }
  }
}`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 24 * 60 * 60 * 1000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

// Turn year/from/to options into a { from, to } range, or null for GitHub's default last year.
export function resolveRange({ year, from, to } = {}) {
  if (year && (from || to)) throw new Error("Use either year or from/to, not both");
  if (year) {
    if (!/^\d{4}$/.test(String(year))) throw new Error(`Invalid year "${year}", expected e.g. 2025`);
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  if (!from && !to) return null;
  for (const [name, v] of [["from", from], ["to", to]])
    if (v && (!DATE.test(v) || isNaN(Date.parse(v)))) throw new Error(`Invalid ${name} date "${v}", expected YYYY-MM-DD`);
  // GitHub limits a contributions query to one year, so an open end defaults to one year from the other.
  if (!to) to = iso(Math.min(Date.parse(from) + 364 * DAY, Date.now()));
  if (!from) from = iso(Date.parse(to) - 364 * DAY);
  const span = (Date.parse(to) - Date.parse(from)) / DAY;
  if (span < 0) throw new Error(`from (${from}) must be on or before to (${to})`);
  if (span > 365) throw new Error(`Range ${from} to ${to} is longer than one year, which GitHub doesn't allow`);
  return { from, to };
}

async function fromGraphQL(user, token, range) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "flight-path" },
    body: JSON.stringify({ query: QUERY, variables: {
      login: user,
      from: range ? `${range.from}T00:00:00Z` : null,
      to: range ? `${range.to}T23:59:59Z` : null,
    } }),
  });
  if (!res.ok) throw new Error(`GraphQL request failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  return weeks.flatMap((w, col) => w.contributionDays.map((d) =>
    ({ date: d.date, row: d.weekday, col, level: LEVELS[d.contributionLevel] ?? 0 })));
}

export function parseContributionsHtml(html) {
  const cells = [];
  const re = /data-date="([^"]+)" id="contribution-day-component-(\d+)-(\d+)" data-level="(\d)"/g;
  for (const m of html.matchAll(re)) cells.push({ date: m[1], row: +m[2], col: +m[3], level: +m[4] });
  return cells;
}

async function fromHtml(user, range) {
  const query = range ? `?from=${range.from}&to=${range.to}` : "";
  const res = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions${query}`, {
    headers: { "User-Agent": "flight-path" },
  });
  if (!res.ok) throw new Error(`Contributions page request failed: ${res.status}`);
  return parseContributionsHtml(await res.text());
}

export async function getGrid(user, token, range = null) {
  const cells = token ? await fromGraphQL(user, token, range) : await fromHtml(user, range);
  if (!cells.length) throw new Error(`No contribution data found for "${user}"`);
  return cells;
}
