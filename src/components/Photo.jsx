/**
 * One <img> for every photograph on the site.
 *
 * `sizes` is required, and it is not decoration — it is how the browser knows
 * which entry in the srcset to download. Give it the width the image actually
 * occupies at that breakpoint; a wrong value here is the usual reason a phone
 * still pulls the largest file.
 */
export default function Photo({ image, sizes, className = '', ...rest }) {
  if (!image) return null;

  return (
    <img
      className={className}
      src={image.src}
      srcSet={image.srcSet || undefined}
      sizes={image.srcSet ? sizes : undefined}
      alt={image.alt}
      decoding="async"
      {...rest}
    />
  );
}
