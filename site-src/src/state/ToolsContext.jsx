import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';
import { ApiError, queryExtinction } from '../data/api.js';
import { InputError } from '../lib/parse.js';
import { resolveSightline } from '../lib/sightline.js';

// Tool state lives above the modal so inputs and results survive closing and
// reopening a tool, and so tools can hand work to each other (e.g. the
// coordinate converter sending a sightline to the extinction query).

const plotStyle = (style) => ({ sigma: '0.1', cmap: 'Spectral_r', ...style });

const toolbox = () => ({ mode: 'ext', picked: [], ebv: '0.3', teff: '5500', result: null, error: null, busy: false });

const initialState = {
  modal: null, // 'query' | 'batch' | 'plot' | 'bcp' | 'tools' | 'reddening' | 'docs' | 'gallery' | null
  query: {
    frame: 'galactic',
    values: { l: '', b: '', ra: '', dec: '', d: '' },
    pos: null,
    result: null,
    error: null,
    busy: false,
  },
  plot: {
    proj: 'car',
    // defaults follow the NADC forms the backend was written for
    car: {
      frame: 'galactic',
      lmin: '0', lmax: '360', bmin: '-90', bmax: '90', dmin: '0', dmax: '3',
      ...plotStyle({ vmin: '0', vmax: '2', scale: 'hist' }),
    },
    sin: {
      frame: 'galactic',
      lc: '0', bc: '0', fov: '30', dmin: '0.5', dmax: '1', mark: true, markColor: 'black',
      ...plotStyle({ vmin: '0.01', vmax: '1', scale: 'log' }),
    },
    dpr: {
      angle: '60', offset: '0.3', halfWidth: '0.1', smin: '-3', smax: '3', zmin: '-0.5', zmax: '0.5',
      origin: true, bubbles: true, vmin: '0.05', vmax: '1', cmap: 'Spectral_r',
    },
    results: { car: null, sin: null, dpr: null }, // { url, filename, caption }
    busy: null, // projection being drawn
    error: null,
  },
  bcp: {
    l: '', b: '', dia: '', dmin: '', dmax: '',
    ...plotStyle({ vmin: '0.01', vmax: '1', scale: 'log' }),
    mark: true,
    markColor: 'black',
    error: null,
    busy: false,
    run: null, // { name, panels: {near, mid, far, analysis, schematic} → {url} | {error} | null, composite }
  },
  batch: { frame: 'galactic', text: '', rows: null, csv: '', error: null, busy: false, fileFormat: 'csv', fileError: null, fileBusy: false, fileDone: null },
  reddening: { t2024: toolbox(), t2023: toolbox() },
  utils: {
    tab: 'coord',
    coordMode: 'equatorial',
    raFormat: 'hms',
    decFormat: 'deg',
    coordValues: {},
    coord: null,
    coordError: null,
    angMode: 'size-to-angle',
    angValues: { size: '', sizeUnit: 'kpc', dist: '', distUnit: 'kpc', theta: '', thetaUnit: 'deg', distRev: '', distRevUnit: 'kpc' },
    angRows: null,
    angError: null,
    text: '',
    textStats: null,
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'modal':
      return { ...state, modal: action.modal };
    case 'patch': {
      const slice = state[action.slice];
      const patch = typeof action.patch === 'function' ? action.patch(slice) : action.patch;
      return { ...state, [action.slice]: { ...slice, ...patch } };
    }
    default:
      return state;
  }
}

/** Convert a thrown error into something the UI can translate (see tools/errorText.js). */
export function toUiError(e) {
  if (e instanceof InputError) return { key: e.key };
  if (e instanceof ApiError) return e.key ? { key: e.key, detail: e.detail } : { message: e.detail };
  return { message: e?.message || String(e) };
}

const ToolsContext = createContext(null);

export function ToolsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const queryRun = useRef(0);

  const update = useCallback((slice, patch) => dispatch({ type: 'patch', slice, patch }), []);
  const openModal = useCallback((modal) => dispatch({ type: 'modal', modal }), []);
  const closeModal = useCallback(() => dispatch({ type: 'modal', modal: null }), []);

  const runQuery = useCallback(
    async (frame, values) => {
      const run = ++queryRun.current;
      let pos;
      try {
        pos = resolveSightline(frame, values);
      } catch (e) {
        update('query', { pos: null, result: null, error: toUiError(e), busy: false });
        return;
      }
      update('query', { busy: true, error: null });
      try {
        const result = await queryExtinction(pos);
        if (run === queryRun.current) update('query', { pos, result, error: null, busy: false });
      } catch (e) {
        if (run === queryRun.current) update('query', { pos: null, result: null, error: toUiError(e), busy: false });
      }
    },
    [update],
  );

  /** Fill the query form with Galactic coordinates, run it and bring the query tool forward. */
  const sendToQuery = useCallback(
    ({ l, b, d }) => {
      const current = state.query.values;
      const values = { ...current, l, b, d: current.d || d };
      update('query', { frame: 'galactic', values });
      openModal('query');
      runQuery('galactic', values);
    },
    [state.query.values, update, openModal, runQuery],
  );

  const value = useMemo(
    () => ({ state, update, openModal, closeModal, runQuery, sendToQuery }),
    [state, update, openModal, closeModal, runQuery, sendToQuery],
  );
  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useTools() {
  return useContext(ToolsContext);
}
