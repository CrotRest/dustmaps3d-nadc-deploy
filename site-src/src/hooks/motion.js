import { useCallback, useEffect, useState } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia(REDUCED_QUERY).matches;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** True while the element is (near) the viewport — used to pause off-screen animation. */
export function useInView(ref, rootMargin = '120px') {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

let revealObserver = null;

function getRevealObserver() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          revealObserver.unobserve(el);
          el.dataset.reveal = 'revealing';
          setTimeout(() => {
            el.dataset.reveal = 'shown';
          }, 750);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -7% 0px' },
    );
  }
  return revealObserver;
}

/** Ref callback: fade + rise the element in the first time it scrolls into view. */
export function useReveal() {
  return useCallback((el) => {
    if (!el || el.dataset.reveal) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      el.dataset.reveal = 'shown';
      return;
    }
    el.dataset.reveal = 'hidden';
    getRevealObserver().observe(el);
  }, []);
}
