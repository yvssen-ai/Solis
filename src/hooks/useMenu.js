import { useEffect, useState } from 'react';
import { restSelect, isSupabaseConfigured } from '../lib/supabase';
import { menu as snapshot, totalItems as snapshotTotal } from '../data/menu';

/**
 * The menu, live from Supabase, falling back to the bundled snapshot.
 *
 * Two things make the fallback worth the extra code. The site renders its menu
 * above the fold on a phone, so waiting on a round trip before drawing anything
 * would mean a visible empty section on every first load; and the page existed as
 * a static brand site before it had a backend, so a database outage should cost
 * the ordering buttons, not the menu itself.
 *
 * So the hook starts from the snapshot, paints immediately, then swaps in live
 * rows when they arrive. `source` says which one you are looking at:
 *
 *   'snapshot' — bundled copy. Prices are correct as of the last build, but the
 *                items carry no database id, so they cannot be ordered.
 *   'live'     — from Supabase. Items have real ids and can go in the cart.
 *
 * The shape is identical either way, which is what lets MenuSection stay as it
 * was written against the static file.
 */

const withOrderability = (sections, orderable) =>
  sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item, orderable })),
  }));

/* Items from the snapshot have no uuid, so nothing can be added to a cart from
   them — the RPC resolves prices by menu_item_id and would reject the order. */
const SNAPSHOT = withOrderability(snapshot, false);

/**
 * Reshape the two flat tables into the nested form the UI already expects.
 * Ordering is done in SQL; this only groups.
 */
const groupRows = (categories, items) => {
  const byCategory = new Map(categories.map((c) => [c.id, []]));

  for (const item of items) {
    const bucket = byCategory.get(item.category_id);
    if (!bucket) continue;
    bucket.push({
      id: item.id,
      name: item.name,
      /* The UI works in whole pounds; the database is the one that keeps
         piastres, so the conversion happens exactly here and nowhere else. */
      price: item.price_piastres / 100,
      pricePiastres: item.price_piastres,
      meta: item.meta ?? undefined,
      signature: item.is_signature || undefined,
      orderable: true,
    });
  }

  /* A category with nothing available in it is not worth a tab. */
  return categories
    .map((category) => ({
      id: category.slug,
      uuid: category.id,
      name: category.name,
      tagline: category.tagline,
      note: category.note,
      items: byCategory.get(category.id) ?? [],
    }))
    .filter((category) => category.items.length > 0);
};

export function useMenu() {
  const [sections, setSections] = useState(SNAPSHOT);
  const [source, setSource] = useState(isSupabaseConfigured ? 'loading' : 'snapshot');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    (async () => {
      try {
        /* Two flat reads rather than one embedded select. PostgREST can nest
           items under categories in a single request, but it applies `limit` per
           parent and makes the child ordering awkward to control; two indexed
           reads and a group in JS is simpler and no slower.

           These go through `restSelect` — a bare fetch — rather than the SDK, so
           the menu is live on first paint without the 62 kB client being on the
           critical path. See src/lib/supabase.js. */
        const [categories, items] = await Promise.all([
          restSelect('menu_categories', 'select=id,slug,name,tagline,note&order=sort_order.asc'),
          restSelect(
            'menu_items',
            'select=id,category_id,name,price_piastres,meta,is_signature&order=sort_order.asc'
          ),
        ]);

        if (cancelled) return;

        const grouped = groupRows(categories, items);

        /* An empty result means an unseeded project. The snapshot is better than
           a blank page, so leave it alone. */
        if (!grouped.length) {
          setSource('snapshot');
          return;
        }

        setSections(grouped);
        setSource('live');
      } catch (failure) {
        if (cancelled) return;
        /* Keep the snapshot on screen — it is still the right menu, just not a
           live one — and record why the swap did not happen. */
        setError(failure);
        setSource('snapshot');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalItems =
    source === 'live'
      ? sections.reduce((sum, section) => sum + section.items.length, 0)
      : snapshotTotal;

  return { sections, source, error, totalItems, isLive: source === 'live' };
}
