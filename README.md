# Flight Path

A GitHub Action that turns your contribution grid into a radar screen. A stealth plane flies a route through every day you contributed, locking on to each blip as it passes. It moves slowly between nearby blips and speeds up across empty stretches.

<p align="center">
  <img src="examples/b2.svg" alt="Flight Path: B-2 Spirit over a contribution grid" width="100%">
</p>

Inspired by [Platane/snk](https://github.com/Platane/snk), the contribution-grid snake. Flight Path is a separate project that keeps the same idea and swaps the snake for aircraft.

## Planes

| Plane | `plane=` | Preview |
| --- | --- | --- |
| B-2 Spirit (default) | `b2` | [examples/b2.svg](examples/b2.svg) |
| F-117 Nighthawk | `f117` | [examples/f117.svg](examples/f117.svg) |
| F-22 Raptor | `f22` | [examples/f22.svg](examples/f22.svg) |
| SR-71 Blackbird | `sr71` | [examples/sr71.svg](examples/sr71.svg) |
| Biplane | `biplane` | [examples/biplane.svg](examples/biplane.svg) |

## Usage

Add `.github/workflows/flight-path.yml` to your profile repo (`<you>/<you>`):

```yaml
name: Flight Path

on:
  schedule:
    - cron: "0 */12 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: maxhayim/flight-path@v1
        with:
          github_user_name: ${{ github.repository_owner }}
          outputs: |
            dist/flight-path.svg
            dist/flight-path-f117.svg?plane=f117

      - uses: crazy-max/ghaction-github-pages@v4
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then show it in your profile README:

```html
<img src="https://raw.githubusercontent.com/<you>/<you>/output/flight-path.svg" alt="Flight Path" width="100%">
```

### Inputs

| Input | Default | Description |
| --- | --- | --- |
| `github_user_name` | (required) | User whose contribution grid to fly over. |
| `outputs` | `dist/flight-path.svg` | One file per line. Add `?plane=<name>` to choose the plane for that file. |
| `plane` | `b2` | Plane for outputs that don't set `?plane=`. |
| `github_token` | `github.token` | Token used to read the contribution calendar. |

## Run it locally

Requires Node 20 or newer. There are no dependencies to install.

```sh
GITHUB_TOKEN=$(gh auth token) node src/cli.mjs <user> 'out/flight-path.svg?plane=sr71'
```

Without `GITHUB_TOKEN` it reads the public contributions page instead.

## License

MIT
