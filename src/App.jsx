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

      /* ScrollSmoother handles the inertial feel on pointer devices and gives
         us `data-speed` parallax everywhere. smoothTouch: 0 deliberately hands
         phones back to native scrolling — it is faster, and it keeps momentum
         and address-bar collapse behaving the way people expect. */
      if (!prefersReducedMotion()) {
        ScrollSmoother.create({
          wrapper: '#smooth-wrapper',
          content: '#smooth-content',
          smooth: 1.15,
          smoothTouch: 0,
          effects: true,
          normalizeScroll: false,
        });
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
