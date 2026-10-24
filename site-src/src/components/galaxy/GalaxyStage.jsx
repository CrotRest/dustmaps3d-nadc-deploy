import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/motion.js';
import { useTools } from '../../state/ToolsContext.jsx';
import './GalaxyStage.css';

/**
 * Fixed full-screen Milky Way behind the whole page. The camera follows the
 * scroll position from section to section; see shots.js for the storyboard.
 */
export default function GalaxyStage() {
  const glRef = useRef(null);
  const mapRef = useRef(null);
  const hudRef = useRef(null);
  const engineRef = useRef(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const { state } = useTools();
  const pausedRef = useRef(false);
  pausedRef.current = Boolean(state.modal);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // three.js is loaded on demand so the page text paints first
    let engine = null;
    let cancelled = false;
    const canvas = glRef.current;
    const onLost = (e) => {
      e.preventDefault();
      setFailed(true);
    };
    import('./engine.js')
      .then(({ createGalaxyEngine }) => {
        if (cancelled) return;
        engine = createGalaxyEngine({ canvas, mapCanvas: mapRef.current, hudCanvas: hudRef.current, reduced: reducedRef.current });
        engine.setPaused(pausedRef.current);
        engineRef.current = engine;
        canvas.addEventListener('webglcontextlost', onLost);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setReduced(reduced);
  }, [reduced]);

  // nothing to see behind an open tool, so stop drawing
  useEffect(() => {
    engineRef.current?.setPaused(Boolean(state.modal));
  }, [state.modal]);

  return (
    <div className={`galaxy-stage${failed ? ' galaxy-stage--fallback' : ''}`} aria-hidden="true">
      <canvas ref={glRef} className="galaxy-stage__gl" />
      <canvas ref={mapRef} className="galaxy-stage__map" />
      <div className="galaxy-stage__scrim" />
      <canvas ref={hudRef} className="galaxy-stage__hud" />
    </div>
  );
}
