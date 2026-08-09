# Family

A wall display for the family — the day's schedule, each kid's routines and
points, meals, recipes, lists and weather. Built to live on an iPad in portrait,
and to work just as well from a phone.

Runs on Netlify: a static React app plus a handful of functions, with Netlify
Blobs as the database. No other services, no API keys, nothing to renew.

---

## Deploy it

1. Push this branch and connect the repo in Netlify (**Add new site → Import an
   existing project**).
2. Netlify reads `netlify.toml`, so the build settings are already right:
   - Build command `npm run build`
   - Publish directory `dist`
   - Functions directory `netlify/functions`
3. Deploy. Blobs are provisioned automatically for the site — there is nothing
   to configure and no environment variables to set.

The first load seeds a starter homeschool schedule, a set of chores, two
routines and a reward catalogue, plus the 14 recipes from the old recipe app.
No people are created — add them on the Family tab, and everything else becomes
assignable.

### On the iPad

- Open the site in Safari → Share → **Add to Home Screen**. It then runs
  full-screen with no browser chrome.
- Settings → Display → **Auto-Lock → Never** so the screen stays on. The app
  also asks for a screen wake lock, but iOS only honours that while the app is
  in the foreground.
- Guided Access (Settings → Accessibility) locks the iPad to just this app if
  you want to hand it to a small person without incident.

---

## Local development

```bash
npm install
npm run dev        # netlify dev — the full app, functions and Blobs
npm run dev:ui     # vite only; the UI runs against localStorage, no functions
npm test           # unit tests for the points, schedule and recipe logic
npm run typecheck
```

`npm run dev` needs the Netlify CLI (`npm i -g netlify-cli`) and a linked site
(`netlify link`) for Blobs to resolve.

---

## The views

| Tab | What it does |
| --- | --- |
| **Today** | The day's schedule on a timeline with a live "now" marker, and the family below. Tap a face to open that person's page. |
| **Calendar** | Month, week and agenda over your subscribed calendars plus events added here. |
| **Routines** | Build the morning/bedtime checklists and the chore list. |
| **Rewards** | Points balances, the reward catalogue, what's waiting to be handed over, and the undo log. |
| **Meals** | The week's menu and the shopping list it feeds. |
| **Recipes** | The recipe vault — scaling, cup↔gram conversion, and import from a link. |
| **To-dos** | Shared lists for the grown-ups. |
| **Family** | Add and edit everyone. |

Weather lives in the top bar; tapping it opens the full forecast. Settings is
the gear, top right.

### A kid's page

Tapping a face opens their page: today's schedule, their routines as big
tick-boxes, their jobs, their points and streak, and the rewards they can
afford.

### Ticking something off

Three things fire from the box that was tapped:

- a confetti burst,
- copies of that item's own emoji thrown with the confetti,
- one big emoji that launches and arcs the full width of the screen, trailing
  ghosts behind it.

Finishing the *last* step of a routine is louder than the steps before it: more
confetti, a larger sprite, the routine's own icon instead of the step's, and the
bonus points floating up. To-dos and shopping items celebrate too, using their
list's icon and their aisle's icon.

It all runs on one canvas plus a handful of DOM sprites, and the animation loop
stops itself the moment nothing is left to draw — this thing runs for weeks
without a reload. `prefers-reduced-motion` turns the whole thing off, as does
the switch in Settings.

### Photos

Profile pictures and sleep-screen photos are resized in the browser before they
are uploaded — 640px for avatars, 2048px for the sleep screen — and re-encoded
to JPEG. A 1.5 MB phone photo lands as roughly 11–100 KB depending on the
subject, which keeps Blob storage small and the iPad's decode fast. Re-encoding
also normalises HEIC, which non-Apple browsers cannot display. EXIF rotation is
applied, so a photo taken sideways is not stored sideways. If a file cannot be
decoded, the original is uploaded unchanged rather than failing.

---

## Connecting your calendar

Settings → Calendars → Add a calendar, then paste the **secret iCal address**:

- **Google Calendar** — Settings → click the calendar under "Settings for my
  calendars" → *Secret address in iCal format*.
- **Apple/iCloud** — Calendar on the web → the broadcast icon next to a calendar
  → copy the `webcal://` link (paste it as-is, it gets rewritten to `https://`).
- **Outlook** — Settings → Calendar → Shared calendars → Publish a calendar →
  copy the ICS link.

Feeds are read-only and are fetched by the server, so the secret URLs never
reach the browser and CORS is a non-issue. Recurring events, exceptions and
all-day events are expanded properly; a feed that breaks reports itself in
Settings rather than silently showing nothing.

Events you add inside the app are stored here, not written back to Google.

---

## How the sync works

- One JSON document in Netlify Blobs holds everything.
- The client polls every 12 seconds with its revision number. Nothing changed →
  the server answers from blob metadata without transferring the document, so
  idling is nearly free. Something changed → it sends the new document.
- Taps apply locally first, then go to the server as **ops** ("tick this chore
  for this kid on this date") rather than as state diffs.
- Ops are the same code on both sides (`shared/ops.ts`), which buys two things:
  a tap can be replayed safely, and if two devices write at the same moment the
  loser replays its ops onto the winner's state and both converge.
- Offline, ops queue in `localStorage` and flush on reconnect. The last known
  state is cached, so a cold start with no wifi still shows the day.

Points are deliberately awarded the instant a kid ticks something. Every award
is a ledger entry a grown-up can undo from **Rewards → History**, which reverses
the balance *and* un-ticks the chore.

---

## Layout of the code

```
shared/          Types, the op reducer, scheduling, recipes — used by both sides
  ops.ts         Every state change, and the only place points are computed
  schedule.ts    "What's due today", streaks, progress
  recipes.ts     Density tables, scaling, the schema.org importer
  seed.ts        First-run content and the forward-migration
netlify/
  functions/     state, calendar, weather, photos, recipe-import
  lib/store.mts  Blob access and the commit protocol
src/
  lib/           API client, offline queue, app state, hooks
  components/    Shell, nav, sheets, confetti, weather glyphs
  views/         One file per tab, editors under views/editors
  styles/        tokens → base → components → views
tests/           Points, scheduling, dates and recipe parsing
```

The recipe measurement engine and the JSON-LD importer are ported from the
standalone recipes app. Behaviour is unchanged — same density tables, same
fraction rendering — but it is typed now, the scale/unit mode is passed in
rather than read from a global, and importing goes through our own function
instead of a public CORS proxy.

---

## Things worth knowing

- **The link is public.** That was a deliberate choice; there is an optional PIN
  in Settings if you change your mind. Netlify's password protection (a paid
  feature) is the stronger option.
- **History is kept for 14 months** and older months are pruned on write, so the
  document stays small.
- **Photos** (profile pictures and sleep-screen photos) go in a separate blob
  store and are served with immutable caching.
- **Everything is editable in the app** — schedule blocks, chores, routines and
  their steps, rewards, lists, people, colours and icons. Nothing needs a code
  change to adjust.
