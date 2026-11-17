# make.fun frontend

[![make.fun bounty](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Khanhduy203/makefun-frontend-01/rank.svg)](https://make.fun/bounty/makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Khanhduy203/makefun-frontend-01/reward.svg)](https://make.fun/bounty/makefun-frontend-01)

A fast, light, fully working frontend for [make.fun](https://make.fun), built from
static files. It reads make.fun's public API alone — no sign-in, no writes, no
third-party code — and shows all four surfaces, each reachable by a link and by
its own URL:

| Route | Surface |
| --- | --- |
| `#/` | The bounty board: every live bounty with its live pot, entry fee, time left and entries, plus search, filters and sorting |
| `#/bounty/<slug>` | A bounty's page: summary, live rewards table, dates, description and full rules |
| `#/bounty/<slug>/leaderboard` | That bounty's leaderboard: ranked entries with scores, records and prize ranks, searchable and paged |
| `#/u/<handle>` | An account's public profile: identity, record and entries |

## Run it

```sh
node serve.ts   # serves app/ on http://localhost:8080
```

Open http://localhost:8080 in a desktop browser. No build step, no install.

## How it is built

- **Vanilla ES modules + one stylesheet**, system fonts only — no framework, no
  webfonts, nothing to download beyond the app itself.
- **One request a view at most.** API answers are cached in memory for 60 seconds
  and revalidated with the ETag the API sent, so revisiting a view costs nothing
  and the board, a bounty page and its leaderboard share one copy of each answer.
- **Long lists stay light.** The leaderboard renders 50 rows at a time and pages
  through the rest; filtering, sorting and paging run on data already fetched.
- **Correct open/closed state.** A bounty past its deadline may still read
  `status: open` until its results publish, so the app decides by the deadline.
- **Safe rendering.** Every API value is escaped before it reaches the page, and
  the small markdown renderer for descriptions and rules escapes first too.

```
app/            the frontend: index.html, main.js (router), views.js,
                api.js (cached fetch), format.js, style.css
screenshots/    3 screenshots of the running app on live data
vendor/         the kit's makefun-frontend.ts, unchanged (builds dossier.json)
main.ts         the entry program: copies app/ + screenshots/ to /output and
                writes /output/dossier.json
serve.ts        local static server for development
shots.json      which routes the screenshots show
```

## Entry

Built for the [make.fun frontend bounty](https://make.fun/bounty/makefun-frontend-01).
`main.ts` hands the app in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.
