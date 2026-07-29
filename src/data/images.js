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

export const gallery = Object.keys(galleryModules)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((path, index) => ({
    id: index,
    src: galleryModules[path],
    alt: `Solis — ${captionFromPath(path)}`,
    caption: captionFromPath(path),
  }));

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
