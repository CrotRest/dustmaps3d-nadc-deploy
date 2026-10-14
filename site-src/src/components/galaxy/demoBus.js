// Which section-01 demo the galaxy HUD plays: 'query' (one sightline locking on),
// 'batch' (a string of sightlines lighting up) or null. The feature rows set it —
// on hover with a mouse, taking turns on touch screens.
export const LOCK_PERIOD = 3.8; // s per single-query lock-on
export const BATCH_PERIOD = 5.2; // s per batch sweep (all lit by ~0.77 of it)

export const demoBus = {
  mode: null,
  listeners: new Set(),
  set(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.listeners.forEach((fn) => fn(mode));
  },
  /** Stop `mode` if it is the one playing. */
  clear(mode) {
    if (this.mode === mode) this.set(null);
  },
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.mode);
    return () => this.listeners.delete(fn);
  },
};
