// Static, language-independent content shown on the page.

export const PAPER_DOI_URL = 'https://doi.org/10.3847/1538-4365/adea39';
export const PACKAGE_DOI_URL = 'https://doi.org/10.12149/101619';
export const PACKAGE_REPO_URL = 'https://github.com/Grapeknight/dustmaps3d';
export const PACKAGE_PYPI_URL = 'https://pypi.org/project/dustmaps3d/';
export const FAST_PACKAGE_URL = 'https://github.com/SunnyHina/dustmaps3d';
/** data_v3.fits.gz — the same two mirrors `dustmaps3d` downloads from. */
export const DATA_NADC_URL = 'https://nadc.china-vo.org/res/file_upload/download?id=51939';
export const DATA_GITHUB_URL = 'https://github.com/Grapeknight/dustmaps3d/releases/download/v3/data_v3.fits.gz';
export const XP_TOOLKIT_URL = 'https://github.com/vnohhf/XP_Extinction_Toolkit';
export const EXT_COEF_URL = 'https://github.com/vnohhf/extinction_coefficient';
export const ZHANG2024_URL = 'https://iopscience.iop.org/article/10.3847/1538-4357/ad613e';
export const ZHANG2023_URL = 'https://iopscience.iop.org/article/10.3847/1538-4365/ac9dfa';
export const NADC_RESOURCES_URL = 'https://nadc.china-vo.org/data/dustmaps/resources/20250922115110';

export const PIP_COMMAND = 'pip install dustmaps3d';

export const CODE_SNIPPET = `from dustmaps3d import dustmaps3d
import numpy as np

l = np.array([160.0])   # Galactic longitude
b = np.array([20.0])    # Galactic latitude
d = np.array([1.5])     # distance in kpc

EBV, dust_density, sigma, max_d = dustmaps3d(l, b, d)
print(EBV)              # E(B-V) [mag]`;

export const BIBTEX = `@ARTICLE{2025ApJS..280...15W,
  author = {{Wang}, Tao and {Yuan}, Haibo and {Chen}, Bingqiu
            and {Xiang}, Maosheng and others},
  title  = "{An All-sky 3D Dust Map Based on Gaia and LAMOST}",
  journal = {\\apjs}, year = 2025, volume = {280},
  number = {1}, eid = {15}, pages = {15},
  doi = {10.3847/1538-4365/adea39}
}`;

export const CITATION_AUTHORS = 'Wang, T., Yuan, H., Chen, B., Xiang, M., Zhang, R., Huang, B., Gu, H., Wang, S., & Li, J. 2025,';
export const CITATION_JOURNAL = 'ApJS';
export const CITATION_TAIL = ', 280, 15.';

export const QUERY_EXAMPLES = [
  { label: 'Orion · l=209 b=-19 d=0.4', l: '209.0', b: '-19.4', d: '0.4' },
  { label: 'NGP · l=0 b=88 d=2.0', l: '0.0', b: '88.0', d: '2.0' },
];

/** One filled-in bubble so the plotter can be tried without knowing a target. */
export const BUBBLE_EXAMPLE = { l: '209.0', b: '-19.4', dia: '8', dmin: '0.3', dmax: '0.5' };

/** Colour maps dustmaps3d-backend accepts for its sky maps. */
export const PLOT_COLORMAPS = ['Spectral_r', 'viridis', 'plasma', 'inferno', 'magma', 'cividis', 'Greys', 'rainbow'];
export const MARK_COLORS = ['black', 'white', 'red', 'blue', 'green', 'yellow'];

/**
 * Filters of the two reddening toolboxes, grouped as in dustmaps3d-backend
 * (toolkit.FILTER_GROUPS / FILTER_GROUPS_2023): [id the API takes, label]. WISE W3/W4 are
 * left out of 2024: XP_Extinction_Toolkit's curve stops at 5.1 µm, so it returns NaN for them.
 */
export const FILTERS_2024 = [
  { sys: 'Johnson', bands: [['Johnson.U', 'U'], ['Johnson.B', 'B'], ['Johnson.V', 'V'], ['Johnson.R', 'R']] },
  { sys: 'Gaia', bands: [['GAIA3.Gbp', 'BP'], ['GAIA3.G', 'G'], ['GAIA3.Grp', 'RP']] },
  { sys: 'SDSS', bands: ['u', 'g', 'r', 'i', 'z'].map((b) => [`SDSS.${b}`, `${b}′`]) },
  { sys: 'Pan-STARRS1', bands: ['g', 'r', 'i', 'z', 'y'].map((b) => [`PS1.${b}`, b]) },
  { sys: '2MASS', bands: [['2MASS.J', 'J'], ['2MASS.H', 'H'], ['2MASS.Ks', 'Ks']] },
  { sys: 'WISE', bands: [1, 2].map((i) => [`WISE.W${i}`, `W${i}`]) },
  { sys: 'Wavelength', bands: [['440', '440nm'], ['550', '550nm']] },
];

export const FILTERS_2023 = [
  { sys: 'GALEX', bands: [['FUV', 'FUV'], ['NUV', 'NUV']] },
  { sys: 'Pan-STARRS1', bands: ['g', 'r', 'i', 'z', 'y'].map((b) => [b, b]) },
  { sys: 'SDSS', bands: ['u', 'g', 'r', 'i', 'z'].map((b) => [`${b}'`, `${b}′`]) },
  { sys: 'Gaia', bands: [['BP', 'BP'], ['G', 'G'], ['RP', 'RP']] },
  { sys: '2MASS', bands: [['J', 'J'], ['H', 'H'], ['Ks', 'Ks']] },
  { sys: 'WISE', bands: [1, 2, 3, 4].map((i) => [`W${i}`, `W${i}`]) },
];

const nadcFigure = (name) => `https://nadc.china-vo.org/data/dustmaps/uploads/cms/${name}`;

/**
 * The twelve figures of the NADC resources page. `src` is a local WebP preview;
 * `href` is the full-resolution original on NADC. Captions live in i18n (galleryCaptions).
 */
export const GALLERY = [
  { src: new URL('../assets/gallery/fig01.webp', import.meta.url).href, href: nadcFigure('dc2184e902dd4ccd91924513222267b1.png'), px: '11227×7162', size: '31.5 MB' },
  { src: new URL('../assets/gallery/fig02.webp', import.meta.url).href, href: nadcFigure('TriColorDustMap.png'), px: '944×482', size: '0.8 MB' },
  { src: new URL('../assets/gallery/fig03.webp', import.meta.url).href, href: nadcFigure('1ddf7a77c76b4eaca8e39693d818526d.png'), px: '4479×2708', size: '12.1 MB' },
  { src: new URL('../assets/gallery/fig04.webp', import.meta.url).href, href: nadcFigure('ArtMapMaxDist.png'), px: '4082×2150', size: '4.6 MB' },
  { src: new URL('../assets/gallery/fig05.webp', import.meta.url).href, href: nadcFigure('dsut1.png'), px: '2535×1418', size: '3.2 MB' },
  { src: new URL('../assets/gallery/fig06.webp', import.meta.url).href, href: nadcFigure('dsut2.png'), px: '2535×1418', size: '4.3 MB' },
  { src: new URL('../assets/gallery/fig07.webp', import.meta.url).href, href: nadcFigure('dsut3.png'), px: '2535×1418', size: '3.9 MB' },
  { src: new URL('../assets/gallery/fig08.webp', import.meta.url).href, href: nadcFigure('dsut4.png'), px: '2535×1418', size: '2.8 MB' },
  { src: new URL('../assets/gallery/fig09.webp', import.meta.url).href, href: nadcFigure('Diskdust.png'), px: '1023×872', size: '0.8 MB' },
  { src: new URL('../assets/gallery/fig10.webp', import.meta.url).href, href: nadcFigure('dustxy.png'), px: '2982×2945', size: '5.5 MB' },
  { src: new URL('../assets/gallery/fig11.webp', import.meta.url).href, href: nadcFigure('DiskMC.png'), px: '3412×2840', size: '5.2 MB' },
  { src: new URL('../assets/gallery/fig12.webp', import.meta.url).href, href: nadcFigure('MCview.png'), px: '2661×2609', size: '1.3 MB' },
];

/** Agent skills, one per section 01–03, published on GitHub; the site hands out install prompts. */
export const SKILLS_REPO_URL = 'https://github.com/CrotRest/dustmaps3d-skills';
export const SKILL_IDS = ['dust-extinction-query', 'dust-sky-map', 'dust-bubble-plot'];

/** Papers that cite Wang et al. (2025): their live list on ADS. */
export const CITED_BY_URL = 'https://ui.adsabs.harvard.edu/abs/2025ApJS..280...15W/citations';
