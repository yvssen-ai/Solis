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

## ⚠️ The logo and the 7 photographs are not in this repository

The repo was empty when this site was built — no commits, no assets — so there
was nothing to sample the brand colours from and nothing to put in the gallery.
Everything below is wired up and waiting; both handoffs are drop-in and need
**no code changes**.

### 1. Add the photographs

Drop the seven images into `src/assets/gallery/`. They are picked up
automatically by a glob in `src/data/images.js`, sorted by filename, and
distributed across the hero, story, showcase, gallery and visit sections.

```
src/assets/gallery/
  01-storefront.jpg     ← becomes the hero
  02-….jpg
  …
  07-….jpg
```

- Supported: `.jpg .jpeg .png .webp .avif .svg`
- The number prefix controls the order — `01-` is the hero image.
- **Delete the seven placeholder `.svg` files that are in there now**, otherwise
  you will have fourteen images.

### 2. Add the logo

Save it as `src/assets/brand-logo.svg` (or `.png` / `.webp`). It replaces the
built-in placeholder mark in the nav automatically.

### 3. Set the brand colours

Open `src/styles/tokens.css`. The first block is the entire palette — nine
values, all documented. Sample the logo and overwrite four of them:

| Token | What to put there |
| --- | --- |
| `--sun` | the dominant / brightest colour in the logo (primary) |
| `--clay` | the secondary or accent colour |
| `--ink` | the darkest colour in the logo (page backgrounds) |
| `--cream` | the lightest colour (text on dark) |

Everything else on the site — buttons, the animated suns, gradients, the scroll
dial, the menu, the footer wordmark — is derived from those, so the whole site
re-skins in one edit.

The palette shipped today is a sun-forward interpretation of the name *Solis*
(Latin, "of the sun"): espresso darks, a golden primary, terracotta accent,
warm cream.

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
    Hero.jsx               parallax photo, rotating sun, per-letter entrance
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
- **ScrollSmoother runs with `smoothTouch: 0`** — phones keep native scrolling,
  which is faster and keeps momentum and address-bar behaviour normal. Pointer
  devices get the inertial feel and `data-speed` parallax.
- **Fixed UI lives outside `#smooth-content`.** A transform on an ancestor
  breaks `position: fixed`, so the nav, the scroll dial and the preloader are
  siblings of the smoothed content, not children.
- **No percentage transforms in CSS on GSAP-animated elements.** Computed style
  reports them already resolved to pixels, so GSAP cannot tell `-101%` from
  `-670px` and a later `yPercent` tween fights the CSS. Where an element slides
  in from off-screen, the offset is owned by the timeline.

## Browser support

Evergreen Chrome, Safari, Firefox and their mobile counterparts. Uses
`color-mix()`, `clamp()`, `100svh`, `aspect-ratio` and `backdrop-filter`.

## Placeholder content to replace

Alongside the images and logo, these are invented and need real values:

- Address, phone, email and social links — `src/components/Visit.jsx` and
  `src/components/Footer.jsx`
- Opening hours — `Visit.jsx`, `Footer.jsx`, `Nav.jsx`, `Hero.jsx`
- The "Open in maps" link — `Visit.jsx`
- Section copy in `Story.jsx` and the six blurbs in `Showcase.jsx`
