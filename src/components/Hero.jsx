import { useRef, useState } from 'react';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../lib/gsap';
import { img, heroVideo } from '../data/images';
import Photo from './Photo';

/* The brand line is the headline — the wordmark is already in the nav and on
   the storefront behind it, so repeating it a third time only competes. */
const TITLE = ['Your', 'sun', 'will', 'rise', 'from', 'here'];

/**
 * In a production build the hero <video> is emitted into index.html so the
 * browser's preload scanner finds it immediately (see vite.config.js). When
 * that element is present this component adopts it rather than rendering a
 * second one, so the fetch that began at ~0.1s is the one that plays. In dev
 * the plugin does not run and this is null, so the JSX <video> below is used.
 */
const preMountedVideo = () =>
  typeof document === 'undefined' ? null : document.getElementById('hero-video');

export default function Hero({ loaded, onNavigate }) {
  const root = useRef(null);
  const videoRef = useRef(null);
  const mediaRef = useRef(null);
  /* Read once at first render: after adoption the element is still findable by
     id, so re-checking later would not tell us whether React owns it. */
  const [usesPreMounted] = useState(() => !!preMountedVideo());
  const hero = img(0);
  /* Every mainstream browser can decode at least one of mp4/webm, but a
     browser with neither (verified directly: a proprietary-codec-free
     Chromium build renders a broken-video glyph over a near-black frame, not
     the poster) needs a real way out. `error` only fires once every listed
     <source> has been tried and failed, so this can only trip after a genuine
     total failure — never a slow network or a mid-swap flicker. */
  const [videoFailed, setVideoFailed] = useState(false);
  /* A reduced-motion visitor never gets the <video> at all (see below), so the
     video's own opening frame doubles as their static hero image — that reads
     as "the same hero, paused" rather than swapping in unrelated photography. */
  const heroPoster = heroVideo?.poster ? { src: heroVideo.poster, alt: hero?.alt ?? 'Solis' } : hero;
  const showVideo = heroVideo && !prefersReducedMotion() && !videoFailed;

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();

      /* Take ownership of the element index.html shipped, moving it into the
         hero ahead of the scrim. Moving a media element does not restart it,
         so whatever it has already buffered since ~0.1s is kept. On reduced
         motion it is dropped instead, which also cancels its download. */
      const pre = preMountedVideo();
      if (pre) {
        if (reduced) {
          pre.remove();
        } else if (mediaRef.current && pre.parentElement !== mediaRef.current) {
          pre.removeAttribute('style');
          mediaRef.current.insertBefore(pre, mediaRef.current.firstChild);
          videoRef.current = pre;
        }
      }

      /* Belt-and-braces autoplay: muted/loop/playsInline/autoPlay on the
         element covers every mainstream browser, but some in-app webviews
         (Instagram, TikTok) still block the attribute-only version. */
      let onVideoError;
      if (!reduced && videoRef.current) {
        const video = videoRef.current;
        video.muted = true;
        video.play?.().catch(() => {});

        /* Attached natively, not via React's onError prop. Confirmed directly
           (React version: fails: identical markup in plain HTML: works) that
           React's synthetic handler for this element fires on an
           intermediate <source> candidate failing, not only once every
           candidate has been tried — the exact case a multi-codec fallback
           exists to survive. The native `error` event on the element itself
           does not have that problem; it only ever fires after the whole
           source list is exhausted, which is what "no browser here can play
           any of this" actually looks like. */
        onVideoError = () => {
          /* React did not create this node when it came from index.html, so it
             will not remove it either — do that here, or a dead <video> stays
             stacked over the poster we are falling back to. */
          if (usesPreMounted) video.remove();
          setVideoFailed(true);
        };
        video.addEventListener('error', onVideoError);
      }
      const videoEl = videoRef.current;

      /* ---- Entrance, fired the moment the preloader hands over ---- */
      if (loaded && !reduced) {
        const tl = gsap.timeline({ defaults: { ease: 'solis' } });

        tl.fromTo(
          '.hero__media',
          { scale: 1.35, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 1.8 }
        )
          .fromTo(
            '.hero__sun',
            { scale: 0.72, opacity: 0, y: 160 },
            { scale: 1, opacity: 0.45, y: 0, duration: 2.1 },
            0.15
          )
          .fromTo(
            '.hero__char',
            { yPercent: 118 },
            { yPercent: 0, duration: 1.15, stagger: 0.085 },
            0.35
          )
          .fromTo(
            '[data-hero-fade]',
            { y: 34, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.11 },
            0.9
          );
      } else if (loaded) {
        gsap.set('.hero__media, .hero__sun, .hero__char, [data-hero-fade]', {
          autoAlpha: 1,
          y: 0,
          yPercent: 0,
          scale: 1,
        });
      }

      if (reduced) return;

      /* ---- The sun keeps turning while you can see it ---- */
      const idle = [
        gsap.to('.hero__rays', {
          rotate: 360,
          duration: 120,
          repeat: -1,
          ease: 'none',
          transformOrigin: '50% 50%',
        }),
        gsap.to('.hero__glow', {
          scale: 1.12,
          opacity: 0.75,
          duration: 4.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        }),
      ];

      /* ---- Scroll-out: title lifts, sun sets, image dims ---- */
      gsap
        .timeline({
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        })
        .to('.hero__title', { yPercent: -55, autoAlpha: 0.15, ease: 'none' }, 0)
        /* It keeps rising as you leave. */
        .to('.hero__sun', { yPercent: -28, ease: 'none' }, 0)
        .to('.hero__foot', { autoAlpha: 0, y: 40, ease: 'none' }, 0)
        .to('.hero__scrim', { opacity: 0.95, ease: 'none' }, 0);

      /* Slow drift on the photograph itself */
      gsap.to('.hero__img', {
        yPercent: 14,
        scale: 1.14,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true },
      });

      /* Bobbing scroll cue */
      idle.push(
        gsap.to('.hero__cue-dot', {
          y: 16,
          duration: 1.3,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        })
      );

      /* Those three loops repeat forever. Left running they keep writing
         transforms — and repainting a 24-line SVG — for the whole length of the
         page, long after the hero has scrolled away. The video gets the same
         treatment: decoding it costs real main-thread time even while paused
         off-screen is cheap, and there is a full-page scroll's worth of other
         sections it has no reason to keep running behind. */
      const heroVisible = ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          idle.forEach((t) => (self.isActive ? t.play() : t.pause()));
          if (self.isActive) videoRef.current?.play().catch(() => {});
          else videoRef.current?.pause();
        },
      });
      idle.forEach((t) => (heroVisible.isActive ? t.play() : t.pause()));

      return () => {
        if (videoEl && onVideoError) videoEl.removeEventListener('error', onVideoError);
      };
    },
    { scope: root, dependencies: [loaded] }
  );

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__media" ref={mediaRef}>
        {/* When index.html already shipped the video, render nothing here —
            the effect moves that element in as this container's first child.
            Rendering a second <video> would download the whole thing twice. */}
        {showVideo && !usesPreMounted ? (
          <video
            ref={videoRef}
            className="hero__img"
            poster={heroVideo.poster ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            aria-hidden="true"
          >
            {/* mp4 first at both sizes. H.264 is the one format every browser
                decodes, so listing it first makes the choice deterministic —
                which is what lets vite.config.js preload exactly the file that
                will actually be used. (Ordering matters: with webm first, a
                Chrome that supports both would take webm and the preload would
                be wasted bandwidth.)

                webm stays as a fallback because "every browser" has holes:
                some Chromium builds strip proprietary codecs — Linux distro
                packages, and Playwright's own test browser, which is how this
                was found — and carry no H.264 decoder at all. Safari is the
                mirror image, with no WebM support, so neither format alone is
                safe. If both fail, the poster takes over (see the error
                listener above).

                The media queries here must stay in step with the preload
                hints in vite.config.js. */}
            {heroVideo.desktop.mp4 && (
              <source src={heroVideo.desktop.mp4} type="video/mp4" media="(min-width: 800px)" />
            )}
            {heroVideo.desktop.webm && (
              <source src={heroVideo.desktop.webm} type="video/webm" media="(min-width: 800px)" />
            )}
            {heroVideo.mobile.mp4 && <source src={heroVideo.mobile.mp4} type="video/mp4" />}
            {heroVideo.mobile.webm && <source src={heroVideo.mobile.webm} type="video/webm" />}
          </video>
        ) : null}
        {/* Poster only when there is no video at all — reduced motion, or every
            source failed. With the adopted element in place it would otherwise
            sit underneath it, downloading for nothing. */}
        {!showVideo && heroPoster && (
          <Photo image={heroPoster} className="hero__img" sizes="100vw" fetchpriority="high" />
        )}
        <div className="hero__scrim" />
        <div className="hero__grain" />
      </div>

      {/* Drawn to match the logo: an open thin-line circle with straight rays. */}
      <svg className="hero__sun" viewBox="0 0 400 400" aria-hidden="true">
        <defs>
          <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--honey)" stopOpacity="0.34" />
            <stop offset="55%" stopColor="var(--sun)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--sun)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="hero__glow" cx="200" cy="200" r="190" fill="url(#heroGlow)" />
        <g className="hero__rays">
          {Array.from({ length: 24 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 24;
            return (
              <line
                key={i}
                x1={200 + Math.cos(a) * 122}
                y1={200 + Math.sin(a) * 122}
                x2={200 + Math.cos(a) * 158}
                y2={200 + Math.sin(a) * 158}
                stroke="var(--white)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.75"
              />
            );
          })}
        </g>
        <circle cx="200" cy="200" r="100" fill="none" stroke="var(--white)" strokeWidth="3.5" opacity="0.85" />
      </svg>

      <div className="hero__body shell">
        <p className="eyebrow hero__eyebrow" data-hero-fade>
          Cafe &amp; Bakery
        </p>

        <h1 className="hero__title">
          <span className="sr-only">Solis — your sun will rise from here</span>
          <span className="hero__title-row" aria-hidden="true">
            {TITLE.map((word, i) => (
              <span className="hero__char-wrap" key={i}>
                <span className="hero__char">{word}</span>
              </span>
            ))}
          </span>
        </h1>

        <p className="hero__sub" data-hero-fade>
          Specialty coffee, ceremonial matcha, and pastry laminated by hand — long before
          the city wakes up.
        </p>

        <div className="hero__actions" data-hero-fade>
          <button className="btn" onClick={() => onNavigate?.('#menu')}>
            See the menu
          </button>
          <button className="btn btn--ghost" onClick={() => onNavigate?.('#visit')}>
            Find us
          </button>
        </div>
      </div>

      <div className="hero__foot shell">
        <div className="hero__cue" data-hero-fade>
          <span className="hero__cue-line">
            <span className="hero__cue-dot" />
          </span>
          <span>Scroll</span>
        </div>
        <p className="hero__hours" data-hero-fade>
          Open daily <span>07:00 — 01:00</span>
        </p>
      </div>
    </section>
  );
}
