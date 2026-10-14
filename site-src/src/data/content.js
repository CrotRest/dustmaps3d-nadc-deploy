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
 * (toolkit.FILTER_GROUPS / FILTER_GROUPS_2023): [id the API takes, label].
 */
export const FILTERS_2024 = [
  { sys: 'Johnson', bands: [['Johnson.U', 'U'], ['Johnson.B', 'B'], ['Johnson.V', 'V'], ['Johnson.R', 'R']] },
  { sys: 'Gaia', bands: [['GAIA3.Gbp', 'BP'], ['GAIA3.G', 'G'], ['GAIA3.Grp', 'RP']] },
  { sys: 'SDSS', bands: ['u', 'g', 'r', 'i', 'z'].map((b) => [`SDSS.${b}`, `${b}′`]) },
  { sys: 'Pan-STARRS1', bands: ['g', 'r', 'i', 'z', 'y'].map((b) => [`PS1.${b}`, b]) },
  { sys: '2MASS', bands: [['2MASS.J', 'J'], ['2MASS.H', 'H'], ['2MASS.Ks', 'Ks']] },
  { sys: 'WISE', bands: [1, 2, 3, 4].map((i) => [`WISE.W${i}`, `W${i}`]) },
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

/**
 * Papers that cite Wang et al. (2025): the ADS citation list (34, 2026-10-14), in ADS order
 * (newest first), each with a one-line note on how it uses the map, taken from the citing
 * sentence where the full text was available. `doi` links to doi.org, `url` is used as is.
 */
export const CITED_BY = [
  { who: 'Ju et al.', year: 2026, journal: 'ApJS', doi: '10.3847/1538-4365/ae99dd', title: 'Distance Estimations of Blue Horizontal-branch Stars from the LAMOST and Sloan Digital Sky Survey Spectroscopic Surveys', use: { zh: '迭代查询本图的红化，估计蓝水平分支星的距离。', en: 'Queries the map iteratively for reddening while estimating BHB-star distances.' } },
  { who: 'Mei et al.', year: 2026, journal: 'RAA', doi: '10.1088/1674-4527/ae616a', title: 'Distances to Molecular Clouds in the Galactic Longitude l = 10°–20° from the MWISP 12CO 1–0 Survey', use: { zh: '作为近年基于 Gaia 的三维消光图之一引用。', en: 'Cited among the recent Gaia-based 3D extinction maps.' } },
  { who: 'Chen et al.', year: 2026, journal: 'ApJ', doi: '10.3847/1538-4357/ae974f', title: 'Host–Non-host Differences in Stellar Chemistry, Activity, and Birth Radius: Hints of Distinct Formation Environments for Earth-like Planets and Sub-Neptunes', use: { zh: '用本图做恒星光度的消光改正。', en: 'Uses the map for extinction corrections of stellar luminosities.' } },
  { who: 'Zhang et al.', year: 2026, journal: 'AJ', doi: '10.3847/1538-3881/ae8774', title: 'A Face-on View of Interstellar Dust in the Galactic Plane', use: { zh: '与本图对照银盘尘埃的俯视分布。', en: 'Compares its face-on view of disk dust with the map.' } },
  { who: 'Kallimanis et al.', year: 2026, journal: 'A&A', doi: '10.1051/0004-6361/202558766', title: 'Milky Way open cluster age determination with spectroscopic priors and machine learning-accelerated inference', use: { zh: '在文中引用了本工作。', en: 'Cites this work.' } },
  { who: 'Bhattacharjee et al.', year: 2026, journal: 'PASP', doi: '10.1088/1538-3873/ae8dff', title: 'Thermally Inflated Accretors in Post-mass Transfer Binaries: A35 and its Class Revisited', use: { zh: '用本图估计目标的红化。', en: 'Uses the map for the targets’ reddening.' } },
  { who: 'McCallum et al.', year: 2026, journal: 'MNRAS', doi: '10.1093/mnras/stag1303', title: 'Milky Way Atlas: a radial-velocity-resolved, three-dimensional map of H I within 1.25 kpc', use: { zh: '作为可与 H I 三维图结合的全天三维消光图之一讨论。', en: 'Discussed as an all-sky 3D extinction map that could be combined with its H I map.' } },
  { who: 'Simon et al.', year: 2026, journal: 'ApJ', doi: '10.3847/1538-4357/ae7e8a', title: 'Radial Velocity Orbital Solutions for Candidate Black Hole and Neutron Star Binary Systems in the Gaia Data Release 3 Catalog', use: { zh: '用本图为全部恒星的测光去红化。', en: 'Dereddens the photometry of every star with the map.' } },
  { who: 'Xu et al.', year: 2026, journal: 'ApJL', doi: '10.3847/2041-8213/ae8ae9', title: 'Unveiling the Nature of G6096: A Likely Hierarchical Triple System', use: { zh: '按距离从本图读取目标的 E(B−V)。', en: 'Reads the target’s E(B−V) from the map at its distance.' } },
  { who: 'Xiong et al.', year: 2026, journal: 'A&A', doi: '10.1051/0004-6361/202660269', title: 'Surface brightness–color relations for red giant branch stars: Observational constraints on metallicity effects using the ARD method', use: { zh: '用本图给红巨星做逐星消光改正。', en: 'Uses the map for star-by-star extinction corrections of red giants.' } },
  { who: 'Nagarajan et al.', year: 2026, journal: 'PASP', doi: '10.1088/1538-3873/ae8699', title: 'Searching for the Third Wheel: High-contrast Imaging Constraints on Tertiaries to Black Hole and Neutron Star Binaries', use: { zh: '用本图的消光换算黑洞/中子星双星的 Ks 星等。', en: 'Uses the map’s extinction to convert Ks magnitudes of black-hole and neutron-star binaries.' } },
  { who: 'Huang et al.', year: 2026, journal: 'A&A', url: 'https://ui.adsabs.harvard.edu/abs/2026A%26A...712L...1H/abstract', title: 'Discovery of EP J175257.3−351923 as a candidate black hole low-mass X-ray binary', use: { zh: '在文中引用了本工作。', en: 'Cites this work.' } },
  { who: 'Zhang et al.', year: 2026, journal: 'arXiv', url: 'https://arxiv.org/abs/2606.31374', title: 'GSED: The Galactic Stellar Extinction Database', use: { zh: '以本工作的 E(B−V) 星表为基准，统一校准多套消光数据。', en: 'Adopts this work’s E(B−V) catalogue as the baseline that calibrates the other extinction datasets.' } },
  { who: 'Liu et al.', year: 2026, journal: 'arXiv', url: 'https://arxiv.org/abs/2606.19694', title: 'PMO Polaris CO survey. II. Where is the dust?', use: { zh: '作为全天尘埃巡天之一引用。', en: 'Cited among the all-sky dust surveys.' } },
  { who: 'El-Badry et al.', year: 2026, journal: 'OJAp', doi: '10.33232/001c.164326', title: 'A systematic survey for hypervelocity runaways from thermonuclear supernovae', use: { zh: '用本图预测候选超高速逃逸星的 E(B−V)。', en: 'Uses the map to predict E(B−V) for its hypervelocity runaway candidates.' } },
  { who: 'Yu et al.', year: 2026, journal: 'MNRAS', doi: '10.1093/mnras/stag848', title: 'High-fidelity stellar extinction with Gaia and APOGEE – I. The method and a new extinction curve', use: { zh: '作为三维消光图与星对法的代表工作引用。', en: 'Cited as an example of 3D extinction mapping with the star-pair method.' } },
  { who: 'Mei et al.', year: 2026, journal: 'ApJS', doi: '10.3847/1538-4365/ae6580', title: 'A Study of the Physical Properties and Star Formation Activity of a Large Sample of Molecular Clouds. I. Distances', use: { zh: '作为由三维消光图定分子云距离的方法之一。', en: 'Cited among the 3D extinction maps used to find molecular-cloud distances.' } },
  { who: 'Shi et al.', year: 2026, journal: 'AJ', doi: '10.3847/1538-3881/ae5e73', title: 'Filter Design for Estimating the Stellar Metallicity of Metal-poor Stars from Gaia XP Spectra', use: { zh: '视线方向的消光取自本图。', en: 'Takes line-of-sight extinction from the map.' } },
  { who: 'Li et al.', year: 2026, journal: 'RAA', doi: '10.1088/1674-4527/ae48b5', title: 'Homogenization of the Stetson Photometry with the Best Star Database', use: { zh: '用本图的 E(B−V) 检验星等差异，并作为星表中的 ebv 列。', en: 'Uses the map’s E(B−V) to test magnitude offsets and as the ebv column of its catalogue.' } },
  { who: 'Wu & Xiao', year: 2026, journal: 'ApJS', doi: '10.3847/1538-4365/ae58a9', title: 'A Deep Learning Framework for Predicting Stellar Spectral Energy Distributions from Multiband Photometric Data', use: { zh: '用本图的 E(B−V) 检验模型结果与红化无关。', en: 'Uses the map’s E(B−V) to check that its results do not depend on reddening.' } },
  { who: 'Tu et al.', year: 2026, journal: 'AJ', doi: '10.3847/1538-3881/ae5dc6', title: 'Dust Absorption toward Supernova Remnant W44', use: { zh: '以本图给出的 W44 方向 A_V 作对照。', en: 'Compares with the map’s A_V toward W44.' } },
  { who: 'He et al.', year: 2026, journal: 'AJ', doi: '10.3847/1538-3881/ae52f7', title: 'Three-dimensional Reddening Maps of the Magellanic Clouds Constructed by RR Lyrae Stars', use: { zh: '作为银河系三维消光图的代表工作引用。', en: 'Cited as one of the recent Milky Way 3D extinction maps.' } },
  { who: 'Zhang et al.', year: 2026, journal: 'AJ', doi: '10.3847/1538-3881/ae5634', title: 'The Extinction Distance of Supernova Remnants in Combination with the CO Line Measurements', use: { zh: '把约 0.5 kpc 处的消光跃变认作本图揭示的本地泡边缘。', en: 'Links an extinction jump at ~0.5 kpc to the Local Bubble edge seen in the map.' } },
  { who: 'Nagarajan et al.', year: 2026, journal: 'PASP', doi: '10.1088/1538-3873/ae5f48', title: 'Testing Models for Fully and Partially Stripped Low-mass Stars with Gaia: Implications for Hot Subdwarfs, Binary RR Lyrae, and Black Hole Impostors', use: { zh: '在文中引用了本工作。', en: 'Cites this work.' } },
  { who: 'Chen et al.', year: 2026, journal: 'ApJ', doi: '10.3847/1538-4357/ae5633', title: 'Insights into the Exoplanet Radius Valley from Host-star Ages, Activity, Chemistry, and Birth Radii', use: { zh: '用本图的消光改正重算宿主星光度。', en: 'Recomputes host-star luminosities with the map’s extinction corrections.' } },
  { who: 'Waisberg & Katz', year: 2026, journal: 'arXiv', url: 'https://arxiv.org/abs/2603.11194', title: 'Upgrading Alpha Crucis to a seven star system. Discovery of Bb and orbital misalignment', use: { zh: '用本图确认 α Cru 方向消光可忽略（A_V ≈ 0.02）。', en: 'Uses the map to confirm that extinction toward α Cru is negligible (A_V ≈ 0.02).' } },
  { who: 'Xiao et al.', year: 2026, journal: 'Sci. Data', doi: '10.1038/s41597-026-06590-z', title: 'A Large and Precise All-Sky Photometric Standard Star Dataset Across More Than 200 Passbands', use: { zh: '在文中引用了本工作。', en: 'Cites this work.' } },
  { who: 'Balser et al.', year: 2025, journal: 'AJ', doi: '10.3847/1538-3881/ae1a72', title: 'The Flocculent Structure of the Inner Milky Way Disk', use: { zh: '作为揭示银盘结构的三维尘埃图之一引用。', en: 'Cited among the 3D dust maps that trace the structure of the disk.' } },
  { who: 'Zhang et al.', year: 2025, journal: 'AJ', doi: '10.3847/1538-3881/ae0ad5', title: 'High Proper Motion Discoveries from the UKIRT Hemisphere Survey', use: { zh: '用于评估目标方向的红化。', en: 'Used to assess the reddening toward its targets.' } },
  { who: 'Liang et al.', year: 2025, journal: 'AJ', doi: '10.3847/1538-3881/ae064b', title: 'Identification of Galactic H I Counterpart of the Large [O III] Emission Structure 1.2° Southeast of M31', use: { zh: '在文中引用了本工作。', en: 'Cites this work.' } },
  { who: 'Guo et al.', year: 2025, journal: 'MNRAS', url: 'https://ui.adsabs.harvard.edu/abs/2025MNRAS.543.1574G/abstract', title: 'Vertical structure of interstellar dust in the Milky Way', use: { zh: '与本图的消光剖面对比银盘尘埃的垂直结构。', en: 'Compares its extinction profiles with the map’s when studying the vertical structure of disk dust.' } },
  { who: 'Liang et al.', year: 2025, journal: 'RAA', doi: '10.1088/1674-4527/ade65b', title: 'The FAST Detection of an H I Cloud around Supernova Remnant G116.6–26.1', use: { zh: '在文中引用了本工作。', en: 'Cites this work.' } },
  { who: 'Ma et al.', year: 2025, journal: 'ApJS', doi: '10.3847/1538-4365/adec7e', title: 'Digitization of Astronomical Photographic Plates from China: Photometric Calibration of Single-exposure Plates and Release of Photometric Catalogs', use: { zh: '在文中引用了本工作。', en: 'Cites this work.' } },
  { who: 'Wang et al.', year: 2025, journal: 'ApJS', doi: '10.3847/1538-4365/aded89', title: 'A Comprehensive All-sky Catalog of 3345 Molecular Clouds from Three-dimensional Dust Extinction', use: { zh: '基于本图证认全天 3345 个分子云。', en: 'Identifies 3345 molecular clouds across the sky from the map.' } },
];
