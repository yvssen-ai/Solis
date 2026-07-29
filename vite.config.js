import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Emits the hero <video> straight into index.html.
 *
 * The video normally lives inside a React component, which means the browser
 * cannot discover its URL until the JS bundle has downloaded, parsed, executed
 * and rendered — measured at ~2.4s on throttled 4G, with the network idle the
 * whole time. Putting the real element in the initial HTML lets the preload
 * scanner find it in the first few hundred bytes, so the fetch starts alongside
 * the bundle instead of after it.
 *
 * Two other approaches were tried and measured first, and neither works:
 *   - <link rel="preload" as="video"> is rejected by Chrome outright, which
 *     logs "uses an unsupported `as` value" and fetches nothing.
 *   - Warming a detached <video> from an inline script does fetch early, but
 *     the element mounted later does not reuse it; it re-requests, and the
 *     duplicate transfer made first frame *later*, not sooner.
 *
 * Hero.jsx adopts this element into `.hero__media` on mount rather than
 * rendering its own, so the download that started at ~0.1s is the same one
 * that ends up playing — nothing is fetched twice. In dev this plugin does not
 * run, the element is absent, and Hero falls back to rendering the <video>
 * itself; keep the two source lists in step.
 */
function heroVideoInHtml() {
  return {
    name: 'hero-video-in-html',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx?.bundle) return html;

        const asset = (needle, ext) =>
          Object.keys(ctx.bundle).find((f) => f.includes(needle) && f.endsWith(ext));

        const sources = [
          { file: asset('hero-desktop', '.mp4'), type: 'video/mp4', media: '(min-width: 800px)' },
          { file: asset('hero-desktop', '.webm'), type: 'video/webm', media: '(min-width: 800px)' },
          { file: asset('hero-mobile', '.mp4'), type: 'video/mp4' },
          { file: asset('hero-mobile', '.webm'), type: 'video/webm' },
        ].filter((s) => s.file);

        if (!sources.length) return html;

        const poster = asset('hero-poster', '.jpg');

        return {
          html,
          tags: [
            {
              tag: 'video',
              attrs: {
                id: 'hero-video',
                class: 'hero__img',
                ...(poster ? { poster: `./${poster}` } : {}),
                muted: true,
                loop: true,
                autoplay: true,
                playsinline: true,
                preload: 'auto',
                disablepictureinpicture: true,
                disableremoteplayback: true,
                'aria-hidden': 'true',
                /* Parked full-bleed behind everything until Hero adopts it.
                   The preloader covers the viewport for the first seconds
                   anyway, so this is never actually seen here. */
                style:
                  'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1',
              },
              children: sources.map((s) => ({
                tag: 'source',
                attrs: {
                  src: `./${s.file}`,
                  type: s.type,
                  ...(s.media ? { media: s.media } : {}),
                },
              })),
              injectTo: 'body-prepend',
            },
          ],
        };
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), heroVideoInHtml()],
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
