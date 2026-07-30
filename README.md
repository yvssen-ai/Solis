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
  lib/
    gsap.js                single place every GSAP plugin is registered
    orderTokens.js         receipt tokens kept on the device, in place of accounts
    scrollToSection.js     in-page navigation that re-aims as the page shifts
    supabase.js            fetch wrappers for PostgREST, money + error helpers
  data/
    menu.js                ← bundled menu snapshot (the offline fallback)
    images.js              gallery glob + logo slot
  hooks/
    useMenu.js             live menu from Supabase, falling back to the snapshot
  context/
    CartContext.jsx        cart lines, localStorage, place_order payload
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
    Shop.jsx               mounts the cart button; lazy-loads the drawer
    CartFab.jsx            floating cart pill, count + running total
    CartDrawer.jsx         cart → checkout → confirmation, and order history
    OrderHistory.jsx       orders placed from this device, with polled status
  styles/
    tokens.css             ← the palette
    base.css               reset, type, buttons, reduced-motion
    sections.css           every section except the menu
    menu.css               menu rail + price list
    shop.css               add buttons, cart pill, drawer, checkout
supabase/
  migrations/              schema, RLS, place_order, menu seed, order emails
```

## Editing the menu

The menu lives in the database — `menu_categories` and `menu_items` — and is
edited in the Supabase dashboard (Table Editor). Prices there are integer
**piastres**: 110 EGP is `11000`. Changes are live on the next page load; no
deploy needed.

`src/data/menu.js` is a **snapshot** of it, bundled into the build. It is what
the site renders in the first moments before the API responds, and what it falls
back to if the API cannot be reached at all — in which case the ordering buttons
disappear and a short notice explains why. Keeping the two in step is worth
doing when prices change, but nothing breaks if they drift: the snapshot is
display-only, and every price on an actual order is read from the database.

Its shape, which is also the shape `useMenu` returns:

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

---

## Backend (Supabase)

The site reads its menu from Supabase and takes orders through it. Everything is
in `supabase/migrations/`, applied in filename order.

### Tables

| Table | What it is | Who can read it |
| --- | --- | --- |
| `menu_categories`, `menu_items` | The menu | Anyone — but only rows that are `is_active` / `is_available` |
| `profiles` | Name and phone, keyed to an auth user | Only its owner |
| `staff` | Membership = being staff | Only your own row |
| `orders`, `order_items` | Orders and their line snapshots | Nobody, directly — see below |

Money is stored as integer **piastres** (1 EGP = 100). Never a float: `0.1 + 0.2`
is `0.30000000000000004` in binary floating point, and a bill that is wrong by a
fraction of a piastre is a bug nobody can explain at the counter.

### How an order is placed

Nobody signs in. Checkout asks for a name and a phone number, which is what the
counter needs to hand a coffee over, and that is the whole identity model.

Clients have **no INSERT privilege on `orders` or `order_items`, and no policy
that would allow one.** The only way in is `place_order(...)`, and the browser
sends nothing but ids and quantities:

```js
rpc('place_order', {
  p_items: [{ menu_item_id: '…', quantity: 2 }],
  p_customer_name: 'Yassen',
  p_customer_phone: '01000000000',
  p_fulfilment: 'pickup',       // or 'delivery', which then requires p_address
})
```

The function reads every name and price from `menu_items` itself, collapses
duplicate lines, and refuses the whole order if any item has become unavailable
rather than quietly shipping a smaller one. Verified directly against the live
database: a payload with an extra `"price_piastres": 1` on a 110 EGP latte
produced an order for 110 EGP — the injected price is never read.

It is `SECURITY DEFINER`, which is what lets it write to tables the caller
cannot, and therefore also what makes it the one place that has to do its own
checking. The advisor flags it as callable by `anon`; that is now the intended
design rather than a finding.

### Reading an order back, without an account

Every order gets a `public_token` — 122 random bits — returned once to whoever
placed it and stored in their browser (`lib/orderTokens.js`). `get_orders(tokens)`
answers only for tokens it is handed. It is a receipt in a pocket, not a login:
whoever holds it can watch that order, and nothing else.

Two consequences worth stating plainly:

- **"My orders" is per-device.** Order on a phone and it is not on the laptop.
  For a cafe that is the right trade — nobody should make an account to buy a
  croissant, and the order number on screen is what the counter asks for anyway.
- **`get_orders` deliberately returns no phone number, address or name.** A token
  is enough to follow an order's progress and no more, so a phone left unlocked
  on a table does not hand over someone's home address.

Status is polled every 20 seconds while the panel is open, and stops once every
order is collected or cancelled. Realtime was the previous approach; it needed a
websocket, which needed the SDK, which is no longer here.

### Stopping abuse

Ownership used to be the limit — an order had to belong to a signed-in user. With
the door open, `place_order` refuses a sixth order from the same phone number
within ten minutes. It is a blunt instrument, and it is meant to be: a real
customer never hits it, and it caps what a script can do without adding anything
a customer has to think about.

### Privileges

Supabase's default privileges grant `anon` and `authenticated` the full set —
including `TRUNCATE` — on every new table in `public`, and rely on RLS to hold the
line. That is not enough on its own, and both gaps were confirmed on this project
before being closed:

- **`TRUNCATE` is not subject to RLS.** Proven on a scratch table with RLS
  enabled and no policies at all: the truncate succeeded, silently. Any signed-in
  user could have emptied the menu.
- **A table-level `UPDATE` grant silently overrides a column-level one**, so
  "staff may only change an order's status" was not actually being enforced.

`20260730042356_restrict_client_table_privileges.sql` revokes everything from
both client roles and grants back only what each needs. The result, which is
worth re-checking after any schema change:

| Role | `menu_*` | `profiles` | `staff` | `orders` | `order_items` |
| --- | --- | --- | --- | --- | --- |
| `anon` | select | — | — | — | — |
| `authenticated` | select | select, insert, update | select | select, `update (status)` | select |

`TRUNCATE`, `DELETE`, `REFERENCES` and `TRIGGER` are held by neither, on any
table, and are revoked from the schema's default privileges so future tables
start the same way.

### Accounts (there are none)

Customers do not sign in, and the site ships no sign-in UI.

It did, briefly: passwordless email with a six-digit code. It was removed because
the code never arrives on a default Supabase project. Editing the auth email
templates requires configuring custom SMTP first, and until that is done the
built-in sender uses fixed templates that send a *link*, pointed at the default
Site URL — `localhost:3000` — and rate-limits itself to a couple of emails an
hour. Every one of those is fixable, and none of it was worth making a customer
do before buying a coffee.

The database side of accounts was left in place: `profiles`, `staff`, the
`user_id` column on `orders` (now nullable) and the RLS policies that read them
are all still there and still correct. `place_order` records `auth.uid()` when
there is one. Re-enabling customer accounts later is a frontend job plus the SMTP
setup, not a migration.

**Staff** read the order queue from the emails and from the Supabase dashboard's
Table Editor. The `staff` table and its policies still work if a signed-in staff
view is wanted later.

### Configuration

`.env` holds the project URL and the **publishable** key. Both are public by
design — the key identifies the project, carries no privileges of its own, and is
shipped to every browser that loads the site — so they are committed, and a fresh
clone or a Vercel build works with no setup. Override them in the host's
environment or in `.env.local` to point at a different project.

The `service_role` / secret key must never appear in this repo, and never in a
`VITE_`-prefixed variable: Vite inlines every one of those into the client
bundle.

### Why there is no Supabase SDK

`@supabase/supabase-js` is 62 kB gzipped — auth, realtime, storage and postgrest
in one package. This site needs to GET two tables and POST to two functions, and
both are a few lines of `fetch` against PostgREST directly (`lib/supabase.js`).

It was carried, lazily loaded, for as long as customers had to sign in. Once
ordering became name-and-phone there was no session to manage, no token to
refresh and no socket to hold open, and the dependency went with it.

Total JavaScript, gzipped, over the life of this feature:

| | Main | Other chunks | Total |
| --- | --- | --- | --- |
| Static brand site, before any backend | 115 kB | — | **115 kB** |
| With accounts, SDK lazy-loaded | 123 kB | 61 kB | **184 kB** |
| Guest ordering, no SDK | 119 kB | 3 kB | **122 kB** |

A complete ordering system for about 7 kB over the brochure it started as.

### Order notifications by email

Every order emails the counter — order number, customer name, phone, items and
total — through [Resend](https://resend.com). It is sent from inside the
database: a constraint trigger on `public.orders` builds the message and posts it
with `pg_net`.

**Setup is one SQL statement and one secret**, with no toolchain:

1. Sign up at [resend.com](https://resend.com) and copy the API key (`re_...`).
   The free tier is 100 emails a day.
2. Run `supabase/migrations/20260730080000_email_orders_from_postgres.sql` in the
   SQL editor.
3. In the same editor, once:

```sql
select vault.create_secret('re_your_key_here', 'resend_api_key');
select vault.create_secret('you@gmail.com',    'order_notify_to');
```

Resend's shared `onboarding@resend.dev` sender needs no domain, and delivers only
to the address that owns the Resend account — which is exactly this use case.
Once a domain is verified, add `order_notify_from` as a third secret.

**This used to be an edge function** (`supabase/functions/notify-order`,
TypeScript, deployed with the CLI). It worked and was tested, but standing up the
CLI — install, log in, link, set secrets, deploy — is a lot of moving parts
between a cafe and its order notifications. The SQL version needs none of it. The
cost is that the email is assembled with `format()` instead of a template, which
is why `html_escape()` exists here and did not there.

**The trigger is `DEFERRABLE INITIALLY DEFERRED`, and that is load-bearing.**
`place_order()` inserts the order row and then its line items. A plain `AFTER
INSERT` trigger fires between those two statements, so the email it built would
list no items at all. Deferring to commit means every item is readable. There is
a test for exactly this: it asserts nothing is queued mid-transaction and that
both line items appear in what is finally sent.

Two deliberate failure modes:

- **Not configured yet is silent.** With no secrets in the vault the trigger
  returns without sending. A missing notification must never be a reason to
  refuse a customer's order.
- **A send failure is swallowed and logged.** Same reasoning; the order is
  already committed and safe.

To see what went out, and what Resend said back:

```sql
select created, status_code, content from net._http_response order by created desc limit 10;
```

To preview an email without sending one:

```sql
select public.order_email(id) ->> 'html' from public.orders order by created_at desc limit 1;
```

### Payments

Orders currently reach the counter and are paid there. Taking payment online
needs a gateway with an Egyptian merchant account — Paymob, Fawry, Kashier,
PayTabs, Amazon Payment Services or Geidea; Stripe does not offer Egyptian
merchant accounts. That work is a server-side step, not a client one: the
callback that marks an order paid must be verified with the gateway's secret,
which cannot live in this bundle. The natural home is a Supabase Edge Function
holding the secret, with a `payment_status` column that only it can write.

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
  in from off-screen, the offset is owned by the timeline. This has now caught
  three elements — the nav overlay, the cart drawer (`translateX(100%)` left
  390px behind, so the sheet never arrived) and the cart pill (`translateY(120%)`
  parked it 41px below the bottom of the screen, with 8px still visible, which is
  why it looked almost right). If a GSAP-animated element ends up offset by
  roughly its own size, this is why.
- **In-page navigation re-aims every frame.** `gsap.to(window, { scrollTo })`,
  `element.scrollIntoView({ behavior: 'smooth' })` and `smoother.scrollTo()` all
  resolve their destination once, when called, and then animate blindly toward
  that number. On a phone the trip from the hero to the menu passes four sections
  of photographs that are still decoding, and each one that lands mid-flight
  pushes the target further down — so the scroll arrives where the menu *was*.
  Measured: with 600px inserted above the target mid-scroll, all three finish
  exactly 600px short. `lib/scrollToSection.js` recomputes the target each frame
  and eases the remaining gap instead. The old tween also had `autoKill: true`,
  which cancelled it the moment a thumb touched the screen.
- **The cart pill and the scroll-progress dial are in opposite corners.** They
  were both `right: var(--gutter); bottom: env(safe-area-inset-bottom) + 1.1rem`
  and rendered on top of each other. Anything else added to a screen corner
  should check `.progress` and `.cart-fab` first.
- **The cart drawer does not lock the body.** `overflow: hidden` on `<body>` is
  the usual way to stop the page behind a drawer, but the document's height comes
  from a spacer ScrollSmoother maintains; collapsing it mid-scroll resets
  `scrollTop`, so the page jumps to the top on open and stays there on close.
  Instead the smoother is paused, the scrim takes `touch-action: none`, and wheel
  events over it are cancelled — nothing that changes layout.

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
`color-mix()`, `clamp()`, `100svh`, `aspect-ratio`, `backdrop-filter` and `:has()`.

## Still invented — replace before launch

The logo, photography and menu are real. These are not:

- Address, phone, email and social links — `src/components/Visit.jsx` and
  `src/components/Footer.jsx`
- Opening hours — `Visit.jsx`, `Footer.jsx`, `Nav.jsx`, `Hero.jsx`
- The "Open in maps" link — `Visit.jsx`
- Section copy in `Story.jsx` and the six blurbs in `Showcase.jsx`

Also outstanding before taking real orders:

1. Run `supabase/migrations/20260730070000_guest_orders.sql` against the project.
   Until it is applied, `place_order` still demands a signed-in user and every
   checkout fails — this is the one that blocks everything else.
2. Run `supabase/migrations/20260730080000_email_orders_from_postgres.sql` and
   add the two vault secrets, or orders arrive silently — see
   [Order notifications by email](#order-notifications-by-email). Without it the
   only place an order appears is the dashboard.

No auth configuration is needed: nobody signs in. See
[Accounts (there are none)](#accounts-there-are-none).

## Deploying

Vercel auto-detects Vite: build `npm run build`, output `dist`. Nothing else to
configure. Note that Vercel builds the **production branch** — if the site 404s
with `NOT_FOUND`, the branch it is building does not contain this code.
