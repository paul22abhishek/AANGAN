# AANGAN — Interior Architecture

A five-page website for a fictional interior architecture practice in Mumbai. Static HTML, CSS and JavaScript with no build step.

## Running it

From this folder:

```bash
python3 -m http.server 4321
```

Then open `http://localhost:4321`. It has to be served over HTTP rather than opened as a `file://` URL, because the page loads its fonts and libraries from CDNs.

## Files

```
index.html      Home — hero, manifesto, selected work, pinned gallery, process, palette, quotes, journal
work.html       Project index with live filtering (state syncs to the URL)
project.html    Case study — Alibaug Residence
studio.html     Practice, people, recognition, clients
contact.html    Enquiry form, studios, FAQ
assets/css/app.css   Design system and all page styles
assets/js/app.js     Motion layer
assets/js/data.js    Project records used by the hero filter bar
```

## Design system

The palette is lime plaster, kota stone, teak and terracotta — bone `#F1EDE6` for surfaces, umber `#1C1713` for the dark bands, terracotta `#AE4E2B` as the single accent. All of it is defined as custom properties at the top of `app.css`, so retheming is a matter of editing that one block.

Three typefaces do three jobs: **Instrument Serif** for display, **Hanken Grotesk** for everything read at length, and **IBM Plex Mono** for indices, metadata and small caps labels. Sizes are fluid `clamp()` values on a single scale.

Layout is a twelve-column grid at `--maxw: 1720px` with fluid gutters. Sections carry generous vertical rhythm and the editorial details — hairline rules, `(01)` section indices, tabular figures — are consistent across pages.

## Motion

[Lenis](https://github.com/darkroomengineering/lenis) drives smooth scrolling, wired into GSAP's ticker so ScrollTrigger stays in sync. On top of that:

- a preloader with a counter and masked wordmark, shown once per session
- a five-panel curtain wipe between pages, intercepting same-origin links
- masked line-by-line reveals via GSAP SplitText, re-split on resize
- a word-by-word colour scrub on the manifesto statement
- a pinned horizontal gallery ("Inside the practice")
- parallax on the hero and case-study images, clip-path wipes on figures
- a custom cursor that grows into a labelled ring over project rows
- a cursor-following image preview on the selected-work list
- magnetic buttons, animated counters, a marquee, and a sticky process column

Everything degrades: `prefers-reduced-motion` disables the lot, the cursor and magnetic effects are skipped on touch, and every module guards on element presence so pages only run what they contain.

## Mobile

Small screens get their own layer rather than a squeezed desktop layout. Tap targets are all at least 44px, the mono small caps go up from 10px to 11px, and vertical rhythm tightens so the page isn't needlessly long.

Three patterns change shape below 720px. The horizontal gallery becomes a snap carousel — cards at 76vw so the next one peeks, with a progress thumb under it. The work page's filter chips collapse from three wrapped rows into one swipeable row with fades at both edges. And a floating action bar rises once you're past the hero, carrying the primary call plus direct phone and email; it steps aside when the page's own closing call to action comes into view, and never appears on the enquiry page, where it would just repeat the form.

Scrolling is deliberately native on touch — Lenis reads the scroll position but doesn't drive it, so you keep the platform's own momentum and rubber-banding. Quotes can be swiped.

## Interactive pieces

The hero commission bar is a real filter — a segmented control plus three custom listboxes (full keyboard support: arrows, Home/End, Enter, Escape) that count matching projects live and hand off to `work.html` with query parameters. The work page filters read those parameters back and write their state into the URL. The contact form validates client-side and shows a confirmation state; the FAQ is an animated accordion.

**The form sends nothing anywhere.** It has no action and no endpoint — submitting only toggles a success state in the browser.

## Screenshot modes

`app.js` supports two query parameters that make the site deterministic for captures:

- `?snap=1` — skips the preloader and intro animations, rendering the settled state
- `?full=1` — as above, plus it neutralises viewport-height layout so the entire page fits in one tall viewport (add `&off=N` to shift the page up by N pixels for pages taller than Chrome's 16384px capture limit)

Both are harmless in normal use.

## Content

The practice, its projects, people, clients and awards are invented. Photography is from Unsplash and loaded by URL; the team portraits are stock images standing in for the fictional names beside them. Replace both before this goes anywhere real.
