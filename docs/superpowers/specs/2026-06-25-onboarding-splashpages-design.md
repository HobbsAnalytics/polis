# Onboarding splashpages — spec

> Add a per-page onboarding splash (intro modal) to each of the four pages.
> Styling per `docs/design/design-system.md`. Built on the existing `src/ui/Modal.tsx`.
> Behavior preserved otherwise. Verify with build + headless smoke + screenshots.

## Goal

Greet new users and explain the app's principles (on Map) and each page's
functionality (Life, History, Profile), with a gentle, non-naggy, dismissible
onboarding overlay.

## Mechanics (locked)

- **Four splashes**, one per page: `map`, `life`, `history`, `profile`.
- **Auto-open once per page, ever (per device).** The Map splash opens on first
  app launch; each other page's splash opens the first time that page is visited.
  Once a page's splash has been seen, it never auto-opens again on that device.
- **"Seen" is recorded when the user either** closes the splash (Got it / Esc /
  scrim / ✕) **or** ticks "Don't show this again". Both mark the page seen; there
  is no separate "shown but not seen" state. (Per approved Q1 option A — the
  checkbox is an explicit early opt-out, mainly meaningful for the Map which
  greets on launch.)
- **Footer:** a "Don't show this again" affordance + a primary "Got it" button.
- **Re-open:** a quiet circled `?` button in each page's header re-opens that
  page's splash on demand (Q2 option A). Re-opening via `?` does NOT auto-mark
  seen — but since the page is already seen by then, it simply shows on request.

## Persistence

- A single standalone localStorage key, e.g. `polis.splash.seen`, holding a
  JSON array/set of seen page ids (`["map","profile",...]`). Matches the existing
  discrete-key pattern in `src/persistence/storage.ts` (city save, last-resolved,
  last-checkin).
- **NOT** part of the city save and **NOT** included in Export/Import — onboarding
  state is per-device, intentionally. (Verify export/import payload is unchanged.)
- Helpers (pure, unit-tested): `hasSeenSplash(page)`, `markSplashSeen(page)`.
  Read/parse defensively (missing/garbage key → empty set).

## Architecture

- **`src/ui/splashContent.ts`** (or `.tsx`) — the copy for all four pages as a
  `Record<Page, { title: string; body: ReactNode }>`. Single source of truth for
  the text; keeps components clean. Body may include the light inline emphasis
  shown in the approved copy.
- **`src/ui/SplashModal.tsx`** — wraps the existing `Modal` (title/onClose/
  children). Renders the page's body + a footer row: a "Don't show this again"
  checkbox/toggle and a primary "Got it" button. Props: `page`, `onClose`,
  `onDontShowAgain` (or a single `onClose(dontShowAgain: boolean)` — implementer's
  call, keep it simple). Closing always marks seen.
- **`App.tsx`** — owns splash state:
  - On mount: if `!hasSeenSplash('map')`, open the Map splash.
  - On page change (`setPage`): if `!hasSeenSplash(page)`, open that page's splash.
    (Guard so re-renders don't reopen; only the *transition* to an unseen page
    triggers it.)
  - Renders `<SplashModal page={activeSplash} .../>` at app root when a splash is
    active. Closing marks that page seen and clears `activeSplash`.
  - A `?` header button per page sets `activeSplash = currentPage` to re-open.
- **No engine/data change.** This is UI + a localStorage UI-pref helper only.

## Copy (approved — final)

**Map — "Welcome to Polis"**
Polis is a visualization of your life, imagined as a city. Tend your daily habits
and it thrives and grows; neglect them and it slowly weathers and crumbles. The
city is divided into **districts** — the key areas of your life (we suggest Work,
Family, Friends, Faith, and Health). Each district holds **boroughs** (you might
split Health into Mind, Body, and Soul). Habits attach to these. For a specific
goal, raise a **landmark** (under Health › Mind, perhaps "Memorize my favorite
poem"). To begin, open **Profile**, add your details, and design your city.

*On this page:* hover a district to find it; click a district in the rail — or a
borough on the map — to see its health and connected habits. Press **Log today**
to record your day.

**Life — "Your life in weeks"**
Every box is one week of your life. Soft bands mark your life eras, and once you
start checking in, each lived week tints by how your city fared — thriving green
to weathered rust. Birthdays are ringed; milestones you add in Profile show up
here. It's the long view: the shape of how you've been living, all at once.

**History — "Walk back through your city"**
Every day you check in — or that simply passes — is saved as a snapshot. Step
through them to see how your city stood on any recorded day, and whether it
thrived or slipped. This view is read-only; nothing here changes your city.

**Profile — "Design your city"**
Profile is where you build your city and set who it belongs to. Add your name and
date of birth (this frames the Life page), then shape the place: create
**districts** for the major areas of your life, divide them into **boroughs**, and
attach **habits** (good or bad, each weighted). Raise a **landmark** for a specific
goal, and add **milestones** to mark big dates on your Life grid. This is your
blueprint — start here.

## Quality floor

- Reuse `Modal`'s accessibility (focus trap, Esc, focus restore, scrim,
  reduced-motion). The `?` trigger receives focus back on close.
- The `?` button: clear `aria-label` ("About this page"), keyboard-focusable,
  styled quietly per the design system (hairline/ghost, not loud).
- Splash content scrolls if it ever exceeds viewport (mobile).
- Don't-show checkbox is keyboard operable and labeled.

## TDD note

Pure helpers (`hasSeenSplash` / `markSplashSeen`, and the seen-set parse) get
failing tests first. UI has no unit harness in this repo (engine/persistence
only), so the modal/auto-open behavior is verified by headless smoke +
screenshots, consistent with prior phases. Full suite must stay green.

## Verify before deploy (then STOP for review)

Full suite green; clean build; headless smoke + screenshots:
1. Fresh state (cleared localStorage) → **Map splash auto-opens on load** with the
   welcome copy + footer (don't-show + Got it).
2. Close it → it does not reappear on reload; visiting **Life/History/Profile**
   each auto-opens its own splash once.
3. The `?` button on each page re-opens that page's splash.
4. "Don't show this again" prevents future auto-open.
5. Export payload is unchanged (no splash key inside).
Do not push until approved.
