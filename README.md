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
    scrollToSection.js     in-page navigation that re-aims as the page shifts
    supabase.js            config, on-demand client loader, money + error helpers
  data/
    menu.js                ← bundled menu snapshot (the offline fallback)
    images.js              gallery glob + logo slot
  hooks/
    useMenu.js             live menu from Supabase, falling back to the snapshot
  context/
    AuthContext.jsx        session, staff flag, owns the Supabase client lifetime
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
    AuthPanel.jsx          passwordless email sign-in
    OrderHistory.jsx       past orders with live status
  styles/
    tokens.css             ← the palette
    base.css               reset, type, buttons, reduced-motion
    sections.css           every section except the menu
    menu.css               menu rail + price list
    shop.css               add buttons, cart pill, drawer, checkout
supabase/
  migrations/              schema, RLS, the place_order function, menu seed
  functions/
    notify-order/          emails each new order to the counter
      index.ts             the handler: verify, read the order, send
      email.ts             subject/text/html formatting, testable on its own
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
| `profiles` | Name and phone, keyed to the auth user | Only its owner |
| `staff` | Membership = being staff | Only your own row |
| `orders`, `order_items` | Orders and their line snapshots | The customer who placed it, or any staff member |

Money is stored as integer **piastres** (1 EGP = 100). Never a float: `0.1 + 0.2`
is `0.30000000000000004` in binary floating point, and a bill that is wrong by a
fraction of a piastre is a bug nobody can explain at the counter.

### How an order is placed

Clients have **no INSERT privilege on `orders` or `order_items`, and no policy
that would allow one.** The only way in is `place_order(...)`, and the browser
sends nothing but ids and quantities:

```js
supabase.rpc('place_order', {
  p_items: [{ menu_item_id: '…', quantity: 2 }],
  p_customer_name: 'Yassen',
  p_customer_phone: '01000000000',
  p_fulfilment: 'pickup',       // or 'delivery', which then requires p_address
})
```

The function reads every name and price from `menu_items` itself, binds the order
to `auth.uid()`, collapses duplicate lines, and refuses the whole order if any
item has become unavailable rather than quietly shipping a smaller one. Verified
directly: a payload with an extra `"price_piastres": 1` on a 110 EGP latte
produced an order for 110 EGP — the injected price is never read.

It is `SECURITY DEFINER`, which is what lets it write to tables the caller
cannot, and therefore also what makes it the one function here that has to do its
own authorization. It does: a null `auth.uid()` is rejected, and `EXECUTE` is
granted to `authenticated` only. The security advisor flags it, as it flags every
`SECURITY DEFINER` function reachable by signed-in users; in this case that is
the intended design and not a finding.

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

### Sign-in

Passwordless email, no password to store or leak. Supabase sends magic links and
six-digit codes through the same endpoint; which one arrives depends entirely on
what the email templates contain.

**Two templates need editing, not one.** Which template Supabase uses depends on
something the site cannot see — whether that address already has an account:

| Who is signing in | Template used | Default subject |
| --- | --- | --- |
| First time — no account yet | **Confirm signup** | "Confirm your email address" |
| Everyone after that | **Magic Link** | "Your sign-in link" |

Editing only Magic Link therefore appears to do nothing, because every new
customer is on the other path. In
[Authentication → Email Templates](https://supabase.com/dashboard/project/_/auth/templates),
set **both** to something like:

```html
<h2>Your Solis sign-in code</h2>
<p>Enter this code to sign in: <strong>{{ .Token }}</strong></p>
```

`{{ .Token }}` is the six-digit code. Leave `{{ .ConfirmationURL }}` out — an
email containing both invites people to tap the link instead, which is the path
that needs redirect configuration.

Once the templates are right, **no URL configuration is needed at all**:
`verifyOtp` is a plain API call and never redirects. That is why the dialog leads
with the code.

If you would rather keep links, the site's own URL must be set as **Site URL**
and listed under **Redirect URLs** in
[Authentication → URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration).
A link that lands on `localhost:3000` means neither has been set — that is the
default Site URL, and Supabase falls back to it whenever `emailRedirectTo` is not
on the allow-list.

On the client, `verifyCode` tries the `email`, `signup` and `magiclink` token
types in turn, so a code works whichever of the two emails produced it, and a
project whose templates were set up one at a time still signs people in rather
than telling a customer their correct code is wrong.

To make someone staff, add their `auth.users` id to the `staff` table. They then
see every order in the drawer and can move an order's status along.

### Configuration

`.env` holds the project URL and the **publishable** key. Both are public by
design — the key identifies the project, carries no privileges of its own, and is
shipped to every browser that loads the site — so they are committed, and a fresh
clone or a Vercel build works with no setup. Override them in the host's
environment or in `.env.local` to point at a different project.

The `service_role` / secret key must never appear in this repo, and never in a
`VITE_`-prefixed variable: Vite inlines every one of those into the client
bundle.

### Why the SDK is loaded on demand

`@supabase/supabase-js` is 62 kB gzipped. Imported normally it took the main
bundle from 115 kB to 178 kB — a 54% increase on the first load of a page whose
job above the fold is a video and a menu, for a feature most visitors never open.
So the anonymous menu read goes through a plain `fetch` against PostgREST
(`restSelect` in `src/lib/supabase.js`; two headers and a query string is the
whole protocol), and the SDK is dynamically imported only when someone starts
ordering — warmed the moment the first item enters the cart, so it has arrived by
the time the drawer is opened. The main bundle is 119 kB, and the SDK plus drawer
are separate chunks.

### Order notifications by email

Every order emails the counter. A trigger on `public.orders` posts the new order's
id to the `notify-order` edge function, which reads the order back and sends it
through [Resend](https://resend.com).

Only the id crosses the wire, deliberately: `place_order()` inserts the order row
first and its line items immediately after, so anything assembled inside the
trigger would describe an order with nothing in it. pg_net queues the request
inside the transaction and sends it after commit, by which point the whole order
is durable and readable.

It sends from the server because it has to. Mail needs a provider API key, and
Vite inlines every `VITE_` variable into the bundle — there is no version of this
that is safe in the browser.

**Setup — four secrets and two commands.** Get a free Resend API key (100
emails/day, no domain needed to start), then:

```bash
supabase link --project-ref <project-ref>

supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxx \
  ORDER_NOTIFY_TO=you@gmail.com \
  ORDER_WEBHOOK_SECRET="$(openssl rand -hex 32)"

# --no-verify-jwt because the caller is Postgres, which has no user session.
# The shared secret below is what actually authenticates the request.
supabase functions deploy notify-order --no-verify-jwt
```

Then tell the database where to post, in the SQL editor — using the *same* random
string you set as `ORDER_WEBHOOK_SECRET`:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/notify-order', 'order_webhook_url');
select vault.create_secret('<the same random string>', 'order_webhook_secret');
```

Until both vault secrets exist the trigger is a no-op — orders are still taken,
they just are not emailed. That is the deliberate failure mode: a mail outage
must never be a reason to refuse a customer's order, so the trigger swallows its
own errors and logs a warning.

To see what was delivered:

```sql
select status_code, content, created from net._http_response order by created desc limit 10;
```

`ORDER_NOTIFY_TO` accepts a comma-separated list if more than one person should
get them. Once you have a domain verified with Resend, set `ORDER_NOTIFY_FROM` to
an address on it — the shared `onboarding@resend.dev` sender works immediately but
is far more likely to land in spam.

The email body is formatted in `supabase/functions/notify-order/email.ts`, kept
free of Deno and network APIs so it can be tested on its own. It is table-based
with inline styles because Gmail strips `<style>` blocks and ignores flexbox and
grid outright — anything cleverer arrives as a stack of unstyled text on exactly
the client this is aimed at. Customer names and notes are HTML-escaped: they are
free text typed by a stranger and they land in your inbox.

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

1. Put `{{ .Token }}` in **both** the *Confirm signup* and *Magic Link* email
   templates, or nobody can sign in — see [Sign-in](#sign-in). This is the one
   that blocks everything else.
2. Deploy `notify-order` and set its secrets, or orders arrive silently — see
   [Order notifications by email](#order-notifications-by-email).
3. Add at least one row to `staff` so somebody can see the order queue.
4. Optional, and only if you want the email links to work as well as the codes:
   set Site URL and Redirect URLs to the deployed address.

## Deploying

Vercel auto-detects Vite: build `npm run build`, output `dist`. Nothing else to
configure. Note that Vercel builds the **production branch** — if the site 404s
with `NOT_FOUND`, the branch it is building does not contain this code.
