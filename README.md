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
No people are created — add them from Home (**+ Person**) or under More →
Family, and everything else becomes assignable.

### On the iPad

- Open the site in Safari → Share → **Add to Home Screen**. It then runs
  full-screen with no browser chrome.
- Settings → Display → **Auto-Lock → Never** so the screen stays on. The app
  also asks for a screen wake lock, but iOS only honours that while the app is
  in the foreground.
- Guided Access (Settings → Accessibility) locks the iPad to just this app if
  you want to hand it to a small person without incident.
- The **moon** button in the top bar starts the photo screen immediately,
  without waiting for the idle timer. It works even if the automatic sleep
  screen is switched off in Settings. Tap the photo to come back.

### Getting updates onto a home-screen app

Once the site is saved to a home screen it runs standalone and caches the
document hard, so a new deploy can go unnoticed indefinitely. Two things keep
that from happening:

- **Cache headers.** The document is served `no-store`. The rule is written for
  both `/` and `/index.html` on purpose: a standalone app loads `/` (the
  manifest's `start_url`), and Netlify matches header rules on the request path,
  so a rule for `/index.html` alone never fires for it. Only the hashed files
  under `/assets/` are cached, and those are immutable by construction.
- **The app checks for itself.** Each build stamps an id into the bundle and
  writes it to `/version.json`. The app re-reads that file every 15 minutes and
  whenever it returns to the foreground; if the deployed id differs you get a
  *"A newer version is ready"* banner. On a wall display nobody taps that, so
  when an update is pending and the sleep screen has been up for two minutes it
  reloads on its own — the screen is showing a photo, so nothing flashes.

**An app installed before this shipped still has the old cached document.** To
get it onto the current build once: delete the home-screen icon, open the URL
in the browser and refresh, then add it to the home screen again. After that it
keeps itself current.

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

Four tabs across the bottom are the ones tapped all day. Everything else lives
behind **More** — the hamburger at the right of the bar — because they are
screens you set up occasionally rather than use constantly. Eight tabs never
fitted a phone.

| Bottom bar | What it does |
| --- | --- |
| **Home** | Just the family: a big face per person, their points, their streak and a ring showing how much of today they have finished. Tap a face to open that person's page. |
| **Schedule** | The day full width, with a live "now" marker — day, week, and a month grid that shows event titles. An **Events** switch folds your connected calendars into the same timeline. |
| **Menu** | The week's meals, repeating meals, and the shopping list it feeds. |
| **To-dos** | Shared lists for the grown-ups. |

| Behind **More** | What it does |
| --- | --- |
| **Routines** | Three tabs: **Schedule** (edit or delete any block of the day), **Routines** (the checklists), **Chores**. |
| **Rewards** | Points balances, the reward catalogue, what's waiting to be handed over, and the undo log. |
| **Recipes** | The recipe vault — scaling, cup↔gram conversion, and import from a link. |
| **Family** | Add and edit everyone. |
| **Weather** | The hourly and the week ahead. |
| **Settings** | Calendars, weather, the sleep screen, backup and restore. |

Weather also lives in the top bar; tapping it opens the full forecast. The gear
top right opens Settings directly, and the moon beside it puts the display to
sleep without waiting for the idle timer.

### Home is the family

Nothing but faces. The rings size themselves to whatever room the screen has,
so a portrait iPad on the wall is readable from across the room while a phone
falls back to something thumb-sized. The heading counts who still owes
something rather than repeating the date and household name already in the top
bar.

The grip icon in the header turns on **Rearrange**, where each card grows a pair
of arrows and its position in the order. Reordering is its own mode on purpose:
the most common thing that happens on this screen is a kid tapping their own
face, and a drag gesture layered on top of that fires by accident all day.

### The sleep screen

After a few idle minutes — or immediately, from the moon in the top bar — the
display becomes a photo frame: a full-bleed photo, the time, the date, and the
weather.

Along the bottom it also carries **Now** and **Next**, side by side: the block
the house is in and the one coming up, with its start time. That is the whole
reason to glance at the thing from the doorway, so it does not require waking
it. When an appointment overlaps a block — a dentist run during Reading — the
block wins the Now slot, because that is what the house is actually doing.
Switch the pair off under Settings → Sleep screen.

### A kid's page

Routines are the point of this screen. Each one is a full card stating its
bonus up front — "Finish all 5 to earn 10 points" — with a progress bar and
big tappable steps. Individual steps pay nothing; completing the *whole*
routine is what earns, so a morning routine is worth its own amount and an
evening routine is worth its own. Both are set per routine on the Routines
tab.

Underneath, **Extra jobs** are à la carte: each tile shows the points it is
worth and can be tapped any time for those points, independently of any
routine. Below that are the rewards they can afford, and their day.

A routine with nobody assigned belongs to every kid, so the seeded Morning and
Bedtime routines work the moment you add people. Name someone explicitly — a
grown-up included — and it becomes theirs alone.

### The schedule, and the Events switch

The household's own blocks are the spine of the day and run full width. Your
connected calendars are *optional* on that timeline: the **Events** switch above
it folds them in, in clock order, or leaves them out.

Off, the schedule reads as a rhythm — the shape a normal homeschool day has.
On, the one appointment that actually matters sits where it belongs in the day
rather than in a column you have to cross-reference. Events never look like
blocks: they carry a calendar tile instead of an emoji and are captioned with
the feed they came from. All-day entries sit on their own strip above the
timeline instead of pretending to have a time.

The switch is a household setting, so it syncs to every device rather than
having to be set on each one.

With more than one calendar connected, per-calendar chips appear so you can hide
work while looking at the family week. That filter is device-local and only
appears when there is actually a choice to make.

The month grid shows event titles, colour-coded by calendar, with "+N more"
where a day is busy — tapping any day opens it.

### A grown-up's page

Parents get a different screen entirely — no routines, no points, no rewards.
It opens on what today looks like (their schedule blocks and calendar events on
one list, with a live "now" marker), then their open tasks, what they are
cooking this week, and everything on the calendar for the next fortnight.
Tasks include anything assigned to them plus anything nobody has claimed.

### Repeating meals

Menu → **Repeats** sets up the ones that come round on a cycle. Schedules
include *every other week*, so "spaghetti every other Monday" is two taps. A
repeating meal fills its slot automatically and is badged as such; pinning a
different meal on one day overrides it for that day only, and clearing a day
keeps it clear rather than letting the repeat come back.

The same *every other week* option is available to schedule blocks, chores and
routines — anything that repeats on a fortnightly cycle.

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

Profile photos open a cropper: drag to move, pinch or use the slider to zoom,
with a circular window matching how avatars actually render. The preview and
the export use the same geometry, so what you frame is what gets saved.

Photos are resized in the browser before upload — 640px for avatars, 2048px for
the sleep screen — and re-encoded to JPEG. A 1.5 MB phone photo lands as roughly 11–100 KB depending on the
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

Points can also be taken away. Tapping anyone's balance on Rewards opens a sheet
to give or remove points by hand — two decisions, how many and what for, with
the reason showing up in History like any other entry (and undoable from there).
Taking away stops at zero rather than putting a kid in debt.

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
