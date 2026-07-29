# Solis — Cafe & Bakery

A mobile-first, animation-led brand site for Solis, built with React + Vite and
animated end to end with GSAP (ScrollTrigger, ScrollSmoother, SplitText,
DrawSVG, CustomEase).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview
```

---

## Brand

Everything is keyed to the real logo, sampled directly from `solis logo.jpg`:

| | |
| --- | --- |
| `#2A4326` | the logo's forest green — 94.9% of the artwork |
| `#F7F9F7` | the logo's white line art and lettering |

Those two, plus supporting greens and warm neutrals lifted from the photography
(cane chairs, concrete walls, sage upholstery), live in `src/styles/tokens.css`.
That file is the only place colour is defined — change a token and the whole
site re-skins.

The logo is white line art on flat green, so the site follows it: deep green
surfaces, white type, thin-line suns drawn to match the mark in the wordmark,
and one warm accent for prices and labels. The brand line — *your sun will rise
from here* — is the hero headline, and the sun rises out of the bottom edge
behind it.

### The logo files

`src/assets/brand-logo.png` is the supplied logo chroma-keyed off its flat green
background, so the white line art drops cleanly onto any surface;
`brand-lockup.png` is the same with the tagline. Both are generated from
`solis logo.jpg`. `<Logo />` uses them automatically — pass `invert` to render
in brand green on light sections.

### The photographs

The eight supplied photos live in `src/assets/gallery/`, renamed so their order
is explicit. They are globbed by `src/data/images.js`, so adding or replacing a
file is all that is needed — no code change.

```
01-storefront.jpg                    → hero
02-your-sun-will-rise-from-here.jpg  → story
03-breakfast-in-the-sun.jpg          → showcase
04-cortado-corner.jpg                → story + showcase
05-iced-matcha-and-coffee.jpg        → showcase
06-from-the-kitchen.jpg              → showcase
07-cookie-tin.jpg                    → showcase
08-two-chairs.jpg                    → visit
```

All eight also appear in the gallery grid.

---

## Structure

```
index.html
src/
  main.jsx                 entry, stylesheet order
  App.jsx                  ScrollSmoother setup, section order, scroll-to
  lib/gsap.js              single place every GSAP plugin is registered
  data/
    menu.js                ← the entire menu lives here
    images.js              gallery glob + logo slot
  components/
    Preloader.jsx          sunrise reveal: rays draw, counter, slat wipe
    Nav.jsx                hide-on-scroll bar + full-screen overlay menu
    ScrollProgress.jsx     sun dial that fills with reading progress
    Hero.jsx               parallax photo, sun rising from the edge, word reveal
    Marquee.jsx            two ribbons; scroll velocity drives speed/direction
    Story.jsx              masked line reveals, clip-path image wipes, counters
    Showcase.jsx           pinned section, vertical scroll → horizontal travel
    MenuSection.jsx        sticky category rail, animated tab switching
    Gallery.jsx            ScrollTrigger.batch reveals + FLIP-style lightbox
    Visit.jsx              hours, contact, setting sun
    Footer.jsx             oversized wordmark that rises on scroll
  styles/
    tokens.css             ← the palette
    base.css               reset, type, buttons, reduced-motion
    sections.css           every section except the menu
    menu.css               menu rail + price list
```

## Editing the menu

`src/data/menu.js` is the single source of truth: section names, taglines,
items and prices. The item count, section count and the "83 items across 9
sections" line on the page are all computed from it.

```js
{
  id: 'matcha',
  name: 'Matcha',
  tagline: 'Ceremonial grade, whisked to order',
  note: '…',
  items: [{ name: 'Hot Spanish Matcha', price: 175 }],
}
```

Optional per-item fields: `meta` (e.g. `'250g'`) and `signature: true` (adds a
"House" flag).

Prices are plain numbers; the `E£` prefix and thousands separators are added by
the UI.

## Animation notes

- **`prefers-reduced-motion` is honoured throughout.** Every component checks it
  and takes a static path: no preloader, no pinning (the showcase becomes a
  swipeable rail), no parallax.
- **ScrollSmoother is created for pointer devices only.** It moves the page by
  transforming `#smooth-content`, and while it is registered ScrollTrigger has
  to pin with transforms too — a transform pin is written from JS, a frame
  behind the compositor. That is invisible when the smoother drives the scroll,
  but on a phone scrolling natively the pinned panel chases the viewport and
  visibly shakes. With no smoother on touch, pins go back to `position: fixed`
  and the compositor holds them. The same applies to `will-change: transform` on
  `#smooth-content`: it makes that element a containing block for fixed
  descendants, so it is only applied under `.has-smoother`.
- **Fixed UI lives outside `#smooth-content`.** A transform on an ancestor
  breaks `position: fixed`, so the nav, the scroll dial and the preloader are
  siblings of the smoothed content, not children.
- **Nothing allocates inside a scroll `onUpdate`.** That callback runs on every
  scroll frame. Building a `gsap.to()` there — especially from a selector string
  with `overwrite: true`, which rescans the global timeline — was costing more
  main-thread time than every other animation on the page combined. Targets are
  recorded in `onUpdate` and applied with `quickSetter`, or eased once per frame
  in a single `gsap.ticker` callback.
- **Repeating animations pause when their section is off screen.** The hero sun,
  the scroll cue, the footer mark and the marquee ribbons all `repeat: -1`; left
  running they keep writing transforms and repainting SVG for the whole length
  of the page.
- **No percentage transforms in CSS on GSAP-animated elements.** Computed style
  reports them already resolved to pixels, so GSAP cannot tell `-101%` from
  `-670px` and a later `yPercent` tween fights the CSS. Where an element slides
  in from off-screen, the offset is owned by the timeline.

## Images

`src/assets/gallery/sized/` holds 480px and 960px copies of each photograph,
used as a `srcset` by `components/Photo.jsx`; the full-size original stays as
the `src` fallback. The originals are 1080–1440px wide and were being painted
into cards a third that size — a phone now pulls 1.57MB instead of 2.46MB.

`sizes` is not decoration: it is how the browser picks a candidate. When adding
a `<Photo>`, give it the width the image actually occupies at that breakpoint.

To regenerate after changing the photos, resize each one to `<name>-480.jpg` and
`<name>-960.jpg` in that folder. The glob that builds the gallery is not
recursive, so the folder never produces extra gallery entries.

## Browser support

Evergreen Chrome, Safari, Firefox and their mobile counterparts. Uses
`color-mix()`, `clamp()`, `100svh`, `aspect-ratio` and `backdrop-filter`.

## Still invented — replace before launch

The logo, photography and menu are real. These are not:

- Address, phone, email and social links — `src/components/Visit.jsx` and
  `src/components/Footer.jsx`
- Opening hours — `Visit.jsx`, `Footer.jsx`, `Nav.jsx`, `Hero.jsx`
- The "Open in maps" link — `Visit.jsx`
- Section copy in `Story.jsx` and the six blurbs in `Showcase.jsx`

## Deploying

Vercel auto-detects Vite: build `npm run build`, output `dist`. Nothing else to
configure. Note that Vercel builds the **production branch** — if the site 404s
with `NOT_FOUND`, the branch it is building does not contain this code.
