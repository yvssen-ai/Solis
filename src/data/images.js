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
