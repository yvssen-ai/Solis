/**
 * Single GSAP entry point.
 *
 * Every plugin is registered here exactly once, before any component runs a
 * tween — importing gsap from anywhere else in the app would risk using an
 * unregistered plugin.
 */
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(
  useGSAP,
  ScrollTrigger,
  ScrollSmoother,
  ScrollToPlugin,
  SplitText,
  CustomEase,
  DrawSVGPlugin
);

/** House easing — a long, unhurried settle. Used across the whole site. */
CustomEase.create('solis', '0.16, 1, 0.3, 1');
CustomEase.create('solisIn', '0.7, 0, 0.84, 0');

/** True when the visitor has asked the OS for less motion. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Split an element into masked lines ready to be staggered up from below.
 * Returns the SplitText instance so callers can `revert()` it if needed.
 */
export const splitLines = (target) =>
  SplitText.create(target, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'split-line',
    autoSplit: true,
  });

export { gsap, useGSAP, ScrollTrigger, ScrollSmoother, SplitText, CustomEase, DrawSVGPlugin };
