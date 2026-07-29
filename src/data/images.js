/**
 * Brand imagery.
 *
 * Drop your photographs into `src/assets/gallery/` and they are picked up
 * automatically — no code change required. Files are sorted by filename, so
 * prefixing them `01-`, `02-`, … controls the running order on the page.
 *
 * Supported: .jpg .jpeg .png .webp .avif .svg
 *
 * The SVG files currently in that folder are brand-toned placeholders. Deleting
 * them and adding the real photos is all that is needed.
 */

const galleryModules = import.meta.glob(
  '../assets/gallery/*.{jpg,jpeg,png,webp,avif,svg,JPG,JPEG,PNG,WEBP,AVIF,SVG}',
  { eager: true, query: '?url', import: 'default' }
);

/**
 * Turn `../assets/gallery/03-lamination.svg` into "Lamination" for alt text.
 */
const captionFromPath = (path) => {
  const file = path.split('/').pop().replace(/\.[^.]+$/, '');
  const words = file.replace(/^\d+[-_]?/, '').replace(/[-_]+/g, ' ').trim();
  if (!words) return 'Solis';
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Downscaled copies live in `src/assets/gallery/sized/` as `<name>-<width>.jpg`
 * and are generated from the originals (see README). The glob above is not
 * recursive, so they never show up as extra gallery entries.
 *
 * They matter on phones: the originals are 1080–1440px wide and were being
 * painted into cards a third that size, so every one of them cost several
 * megabytes of decoded bitmap for pixels nobody could see.
 */
const sizedModules = import.meta.glob('../assets/gallery/sized/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const variantsByBase = {};
for (const path of Object.keys(sizedModules)) {
  const file = path.split('/').pop().replace(/\.[^.]+$/, '');
  const match = file.match(/^(.*)-(\d+)$/);
  if (!match) continue;
  (variantsByBase[match[1]] ||= []).push({ w: Number(match[2]), url: sizedModules[path] });
}
Object.values(variantsByBase).forEach((v) => v.sort((a, b) => a.w - b.w));

const baseName = (path) => path.split('/').pop().replace(/\.[^.]+$/, '');

export const gallery = Object.keys(galleryModules)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((path, index) => {
    const variants = variantsByBase[baseName(path)] ?? [];
    return {
      id: index,
      src: galleryModules[path],
      /* Full-size original stays as the `src` fallback, so a browser without
         srcset support still gets a working image. */
      srcSet: variants.length
        ? variants.map((v) => `${v.url} ${v.w}w`).join(', ')
        : null,
      alt: `Solis — ${captionFromPath(path)}`,
      caption: captionFromPath(path),
    };
  });

/**
 * Pull image N safely, wrapping around if fewer images are present than a
 * section asks for. Keeps the layout intact whatever the folder contains.
 */
export const img = (index) => (gallery.length ? gallery[index % gallery.length] : null);

/**
 * Your logo. Drop a file named `brand-logo.svg` (or .png/.webp) into
 * `src/assets/` and it replaces the built-in placeholder mark everywhere.
 */
const logoModules = import.meta.glob('../assets/brand-logo.{svg,png,webp,jpg,jpeg,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const brandLogo = Object.values(logoModules)[0] ?? null;

/**
 * The hero's looping video, if there is one.
 *
 * Drop `hero-mobile.mp4` / `.webm`, `hero-desktop.mp4` / `.webm`, and
 * `hero-poster.jpg` into `src/assets/hero/` and the hero switches from the
 * static photo to the loop automatically — no code change. `hero-poster.jpg`
 * should be the video's own first frame, so there is no visible jump when
 * playback starts; it also stands in as the static image when
 * `prefers-reduced-motion` is on, and as the fallback if a browser can decode
 * neither video format at all (see Hero.jsx's `onError` handler).
 *
 * The desktop/mobile split is a bandwidth split, not a quality one — swap in
 * whatever crop suits your footage. Both sizes want both formats: no browser
 * plays every codec — Safari has no WebM support at all; some Chromium builds
 * (Linux distros that strip proprietary codecs, and Playwright's own test
 * browser, confirmed directly) have no H.264 decoder — so a size with only
 * one format risks going dark for whichever browser can't decode it. Missing
 * a whole size (e.g. no mobile files) just means every visitor gets the
 * other one, which degrades gracefully instead.
 */
const heroVideoModules = import.meta.glob('../assets/hero/hero-{mobile,desktop}.{mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const heroVideoUrl = (basename) =>
  Object.entries(heroVideoModules).find(([path]) => path.endsWith(`/${basename}`))?.[1] ?? null;

const heroPosterModules = import.meta.glob('../assets/hero/hero-poster.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const heroVideoSet = {
  mobile: { mp4: heroVideoUrl('hero-mobile.mp4'), webm: heroVideoUrl('hero-mobile.webm') },
  desktop: { mp4: heroVideoUrl('hero-desktop.mp4'), webm: heroVideoUrl('hero-desktop.webm') },
  poster: Object.values(heroPosterModules)[0] ?? null,
};

export const heroVideo =
  heroVideoSet.mobile.mp4 || heroVideoSet.mobile.webm || heroVideoSet.desktop.mp4 || heroVideoSet.desktop.webm
    ? heroVideoSet
    : null;
