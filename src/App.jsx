import { useRef, useState } from 'react';
import { gsap, useGSAP, ScrollTrigger, ScrollSmoother, prefersReducedMotion } from './lib/gsap';

import Preloader from './components/Preloader';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import Story from './components/Story';
import Showcase from './components/Showcase';
import MenuSection from './components/MenuSection';
import Gallery from './components/Gallery';
import Visit from './components/Visit';
import Footer from './components/Footer';
import ScrollProgress from './components/ScrollProgress';

export default function App() {
  const root = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useGSAP(
    () => {
      document.documentElement.classList.add('js-ready');

      /* A phone hiding or showing its address bar fires a resize, and a resize
         re-measures every trigger. Mid-scroll that lands as a jump. This tells
         ScrollTrigger to ignore those specific vertical resizes. */
      ScrollTrigger.config({ ignoreMobileResize: true });

      const isTouch = window.matchMedia('(hover: none)').matches;

      /* ScrollSmoother is for pointer devices only.
         It moves the page by transforming #smooth-content, so while it is
         registered ScrollTrigger has to pin with transforms too — it cannot use
         `position: fixed` inside a transformed ancestor. Transform pinning is
         updated from JS, one frame behind the compositor, which is invisible
         when the smoother is driving the scroll but reads as a shake on a phone
         scrolling natively. Leaving it uncreated on touch lets pins go back to
         `position: fixed`, which the compositor handles on its own. */
      if (!prefersReducedMotion() && !isTouch) {
        ScrollSmoother.create({
          wrapper: '#smooth-wrapper',
          content: '#smooth-content',
          smooth: 1.15,
          effects: true,
          normalizeScroll: false,
        });
        document.documentElement.classList.add('has-smoother');
      }

      /* Images and webfonts change layout height; recalculate every trigger
         once everything has actually landed. */
      const onLoad = () => ScrollTrigger.refresh();
      window.addEventListener('load', onLoad);
      if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

      return () => window.removeEventListener('load', onLoad);
    },
    { scope: root }
  );

  const handleLoaderDone = () => {
    document.body.classList.remove('is-loading');
    setLoaded(true);
    ScrollTrigger.refresh();
  };

  const scrollTo = (id) => {
    const smoother = ScrollSmoother.get();
    if (smoother) {
      smoother.scrollTo(id, true, 'top top');
    } else {
      gsap.to(window, { duration: 1, scrollTo: { y: id, autoKill: true }, ease: 'solis' });
    }
  };

  return (
    <div ref={root}>
      <Preloader onDone={handleLoaderDone} />
      <Nav onNavigate={scrollTo} />
      <ScrollProgress />

      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <Hero loaded={loaded} onNavigate={scrollTo} />
            <Marquee />
            <Story />
            <Showcase />
            <MenuSection />
            <Gallery />
            <Visit />
          </main>
          <Footer onNavigate={scrollTo} />
        </div>
      </div>
    </div>
  );
}
