import { ScrollSmoother, prefersReducedMotion } from './gsap';

/**
 * Scroll to a section, re-aiming as the page changes shape underneath.
 *
 * Every obvious way to do this picks its destination once, at the moment of the
 * tap, and then animates blindly toward that number:
 *
 *   - `gsap.to(window, { scrollTo: '#menu' })` resolves the selector on the
 *     first tick. It was also `autoKill: true`, which cancels the tween as soon
 *     as the user touches the screen — a thumb resting after a tap left the page
 *     stranded in whatever section it had reached.
 *   - `element.scrollIntoView({ behavior: 'smooth' })` is no better. The CSSOM
 *     spec has it compute the target position when it is called; the browser
 *     does not follow the element afterwards. Measured: with 600px of content
 *     inserted above the target mid-flight, it finishes exactly 600px short.
 *   - `smoother.scrollTo(target, true)` resolves the offset once too, and fails
 *     the same test.
 *
 * That matters on a phone rather than on a desk. The trip from the hero to the
 * menu passes four sections of photographs; on a real connection they are still
 * decoding, and each one that lands while the scroll is in flight pushes the
 * menu further down. The scroll arrives where the menu *was*.
 *
 * So the target is recomputed every frame and the easing is applied to the gap
 * that remains. A moving endpoint with an eased fraction is the standard way to
 * chase a target, and it degrades to an ordinary ease when nothing moves.
 */

const DURATION = 900;

/* easeOutCubic — close enough to the house 'solis' feel, without needing GSAP
   to own the scroll position. */
const ease = (t) => 1 - (1 - t) ** 3;

let cancelCurrent = null;

export function scrollToSection(selector) {
  const target = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!target) return;

  /* A second tap while the first is still running should retarget, not race. */
  cancelCurrent?.();

  const smoother = ScrollSmoother.get();

  /* With ScrollSmoother running it owns the scroll position — writing to
     window.scrollY directly gets overwritten on its next tick. */
  const positionOf = () => {
    if (smoother && typeof smoother.offset === 'function') {
      return smoother.offset(target, 'top top');
    }
    return target.getBoundingClientRect().top + window.scrollY;
  };
  const readScroll = () => (smoother ? smoother.scrollTop() : window.scrollY);
  const writeScroll = (y) => (smoother ? smoother.scrollTop(y) : window.scrollTo(0, y));

  if (prefersReducedMotion()) {
    writeScroll(positionOf());
    return;
  }

  const from = readScroll();
  const started = performance.now();
  let frame = 0;
  let stopped = false;

  /* Deliberate interruption should hand control back. Listening for 'scroll'
     would be wrong — this animation writes the scroll position itself and would
     immediately cancel on its own first frame. A wheel or a finger is
     unambiguously the user. */
  const interrupt = () => stop();
  const cleanup = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('wheel', interrupt, { passive: true });
    window.removeEventListener('touchstart', interrupt, { passive: true });
    if (cancelCurrent === stop) cancelCurrent = null;
  };
  function stop() {
    stopped = true;
    cleanup();
  }
  cancelCurrent = stop;

  window.addEventListener('wheel', interrupt, { passive: true });
  window.addEventListener('touchstart', interrupt, { passive: true });

  const step = (now) => {
    if (stopped) return;

    const t = Math.min(1, (now - started) / DURATION);
    const to = positionOf();

    if (t < 1) {
      writeScroll(from + (to - from) * ease(t));
      frame = requestAnimationFrame(step);
      return;
    }

    /* Land on the live position, not on whatever it was a frame ago, so a shift
       in the last few milliseconds cannot leave the heading half off screen. */
    writeScroll(to);
    cleanup();
  };

  frame = requestAnimationFrame(step);
}
