// Fetch a user's contribution calendar as [{ date, row, col, level }].
// Uses the GraphQL API when a token is available, otherwise the public contributions page.

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar { weeks { contributionDays { date weekday contributionLevel } } }
    }
  }
}`;

async function fromGraphQL(user, token) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "flight-path" },
    body: JSON.stringify({ query: QUERY, variables: { login: user } }),
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

async function fromHtml(user) {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`, {
    headers: { "User-Agent": "flight-path" },
  });
  if (!res.ok) throw new Error(`Contributions page request failed: ${res.status}`);
  return parseContributionsHtml(await res.text());
}

export async function getGrid(user, token) {
  const cells = token ? await fromGraphQL(user, token) : await fromHtml(user);
  if (!cells.length) throw new Error(`No contribution data found for "${user}"`);
  return cells;
}
