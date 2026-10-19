// Long-form reference pages shown in modals: the dustmaps3d documentation and the
// reddening-coefficient guide (zh supplied by the authors; en translated).
//
// Blocks: ['h2' | 'h3' | 'p' | 'note' | 'formula', text] · ['code', text] · ['ul' | 'ol', items]
// · ['table', head, rows] · ['note', text, title?] · ['toolbox', '2024' | '2023'].
// Inline markup (see RichText.jsx): [label](url) links, [label](#open:modal) opens a modal,
// `code`, **bold**, x_{sub}, x^{sup}.
import {
  DATA_GITHUB_URL,
  DATA_NADC_URL,
  EXT_COEF_URL,
  FAST_PACKAGE_URL,
  PACKAGE_DOI_URL,
  PACKAGE_REPO_URL,
  PAPER_DOI_URL,
  XP_TOOLKIT_URL,
  ZHANG2023_URL,
  ZHANG2024_URL,
} from '../data/content.js';

const SINGLE = `from dustmaps3d import dustmaps3d

l = [120.0]
b = [30.0]
d = [1.5]

EBV, dust, sigma, max_d = dustmaps3d(l, b, d)

print(f"EBV: {EBV.values[0]:.4f} [mag]")
print(f"Dust: {dust.values[0]:.4f} [mag/kpc]")
print(f"Sigma: {sigma.values[0]:.4f} [mag]")
print(f"Max distance: {max_d.values[0]:.4f} kpc")`;

const FITS_BATCH = `import numpy as np
from astropy.table import Table
from dustmaps3d import dustmaps3d

data = Table.read('input.fits')
l = data['l'].astype(float)
b = data['b'].astype(float)
d = data['d'].astype(float)

EBV, dust, sigma, max_d = dustmaps3d(l, b, d)

data['EBV_3d'] = EBV
data['dust'] = dust
data['sigma'] = sigma
data['max_distance'] = max_d
data.write('output.fits', overwrite=True)`;

const CSV_BATCH = `import numpy as np
import pandas as pd
from dustmaps3d import dustmaps3d

df = pd.read_csv("input.csv",)

l = df["l"]
b = df["b"]
d = df["d"]

EBV, dust, sigma, max_d = dustmaps3d(l, b, d)

df["EBV_3d"] = np.asarray(EBV)
df["dust"]   = np.asarray(dust)
df["sigma"]  = np.asarray(sigma)
df["max_distance"] = np.asarray(max_d)

df.to_csv("output.csv", index=False)`;

const PATH_WIN = 'C:\\Users\\<用户名>\\AppData\\Local\\dustmaps3d\\data_v3.fits';
const PATH_NIX = '/home/<用户名>/.local/share/dustmaps3d/data_v3.fits';
const PATH_WIN_EN = 'C:\\Users\\<username>\\AppData\\Local\\dustmaps3d\\data_v3.fits';
const PATH_NIX_EN = '/home/<username>/.local/share/dustmaps3d/data_v3.fits';

export const REFERENCE = {
  zh: {
    docs: [
      ['p', '基于 Gaia 和 LAMOST 构建的全天三维尘埃消光图。'],
      ['ul', [
        `GitHub：[Grapeknight/dustmaps3d](${PACKAGE_REPO_URL})`,
        `Wang et al. (2025)，An all-sky 3D dust map based on Gaia and LAMOST · DOI: [10.3847/1538-4365/adea39](${PAPER_DOI_URL})`,
        `A Python package for easy access to the 3D dust map · DOI: [10.12149/101619](${PACKAGE_DOI_URL})`,
      ]],
      ['h2', '安装'],
      ['p', '通过 pip 安装：'],
      ['code', 'pip install dustmaps3d'],
      ['h2', '数据文件说明'],
      ['note', '安装包本身不包含数据文件。首次使用时将自动从 GitHub 或 NADC 下载约 400MB 的模型数据文件。'],
      ['h3', '自动下载机制'],
      ['ul', [
        '调用 `dustmaps3d()` 时会自动尝试下载数据文件 `data_v3.fits.gz`；',
        '下载完成后自动解压为 `data_v3.fits`，并缓存于本地；',
        '下次使用将直接读取缓存，无需重复下载。',
      ]],
      ['p', `国内用户会自动识别并优先从国家天文数据中心下载数据，无需翻墙：[NADC 数据中心](${DATA_NADC_URL})`],
      ['p', `如果下载失败将自动切换为备选源：[GitHub Releases](${DATA_GITHUB_URL})`],
      ['p', '对于非中文系统用户，默认下载顺序将反转，优先使用 GitHub。'],
      ['h3', '下载失败怎么办？'],
      ['p', '如果下载失败（例如 connect timeout），你也可以手动下载数据文件并放入缓存目录：'],
      ['ol', [
        `打开镜像链接：国内用户：[NADC 数据中心](${DATA_NADC_URL})；国际用户：[GitHub Releases](${DATA_GITHUB_URL})`,
        '下载文件：`data_v3.fits.gz`',
        '解压得到：`data_v3.fits`',
        '将其放入本地缓存目录（首次调用时终端会打印出路径提示）',
      ]],
      ['p', '示例路径（Windows）：'],
      ['code', PATH_WIN],
      ['p', '示例路径（Linux/macOS）：'],
      ['code', PATH_NIX],
      ['h2', '使用示例'],
      ['code', SINGLE],
      ['p', 'FITS 文件批量处理示例：'],
      ['code', FITS_BATCH],
      ['p', 'CSV 文件批量处理示例：'],
      ['code', CSV_BATCH],
      ['h2', '进阶用户提示'],
      ['p', '为了兼容性和易用性，本 dustmaps3d 做了一定的优化权衡，牺牲了部分性能以确保广泛环境下的稳定运行。'],
      ['p', `如果您对性能有更高要求（如支持多进程并行计算、通过命令行使用、更快的加载和 I/O 速度等），欢迎尝试由开发者 SunnyHina 提供的实现：[SunnyHina/dustmaps3d](${FAST_PACKAGE_URL})。该版本采用更加现代化的数据加载方案，适合需要大规模批量处理的高级用户。`],
      ['h2', '函数说明'],
      ['p', '`dustmaps3d(l, b, d)`：根据输入的银河坐标 (l, b) 和距离 d，返回对应的尘埃消光信息。'],
      ['table', ['输入', '类型', '描述', '单位'], [
        ['l', 'np.ndarray', '银经', '度'],
        ['b', 'np.ndarray', '银纬', '度'],
        ['d', 'np.ndarray', '距离', 'kpc'],
      ]],
      ['table', ['输出', '类型', '描述', '单位'], [
        ['EBV', 'np.ndarray', 'E(B–V) 消光值', 'mag'],
        ['dust', 'np.ndarray', '尘埃密度（d(EBV)/dx）', 'mag/kpc'],
        ['sigma', 'np.ndarray', 'E(B–V) 的不确定度估计', 'mag'],
        ['max_d', 'np.ndarray', '每条视线方向上可靠的最大距离', 'kpc'],
      ]],
      ['ul', [
        '如果输入的 d 中包含 NaN，程序将自动将其替换为该视线方向的最大可靠距离（max_d）。',
        '如果输入的 d 超过了 max_d，则说明该点超出了模型的可靠范围。此时返回的值是通过外推计算的，不具有可靠性。',
      ]],
      ['h2', '性能'],
      ['ul', ['基于 NumPy 完全向量化实现', '在普通个人计算机上，单线程处理 **一亿颗恒星** 仅需约 100 秒']],
      ['h2', '红化系数（Reddening Coefficient）'],
      ['p', '在获得 E(B−V) 后，通常需要对观测到的星等或色指数进行消光校正（红化修正），以恢复恒星的内禀光度或颜色。对于任意波段的消光校正或色指数的红化修正，关键在于确定该波段或颜色对应的红化系数 R_{λ} 或 R_{(a−b)}。'],
      ['p', '我们在 [红化系数](#open:reddening) 中对红化系数的获取方法进行了详细说明，并提供了在线计算工具，用户可以直接输入参数快速获取所需的红化系数。'],
      ['h2', '引用说明'],
      ['p', '如果您在研究中使用了该工作或包，请引用以下两项：'],
      ['ol', [
        `Wang, T. et al. (2025), An all-sky 3D dust map based on Gaia and LAMOST · DOI: [10.3847/1538-4365/adea39](${PAPER_DOI_URL})`,
        `dustmaps3d: A Python package for easy access to the 3D dust map · DOI: [10.12149/101619](${PACKAGE_DOI_URL})`,
      ]],
      ['h2', '授权协议'],
      ['p', 'MIT License'],
      ['h2', '联系方式'],
      ['p', `如在使用本工具过程中有任何问题、建议或技术交流，欢迎通过 [GitHub issue](${PACKAGE_REPO_URL}/issues) 或邮箱联系作者团队：`],
      ['ul', [
        'Prof. Yuan Haibo（苑海波 教授）：[yuanhb@bnu.edu.cn](mailto:yuanhb@bnu.edu.cn)',
        'Wang Tao（王涛）：[wt@mail.bnu.edu.cn](mailto:wt@mail.bnu.edu.cn)',
      ]],
    ],
    reddening: [
      ['p', '在获得 E(B−V) 后，可对观测色指数进行红化修正（(B−V)_{0} = (B−V)_{obs} − E(B−V)），以恢复恒星的内禀颜色。然而，E(B−V) 仅给出了相对于 B−V 的色余，若要在其他波段（如 G、J、V 等）和色指数（如 BP−RP、V−K 等）进行校正，还需知道该波段消光与 E(B−V) 之间的比例关系——这一比例即为红化系数。'],
      ['note', '对给定 **波段** 的星等进行改正通常称为 **消光改正**；对给定 **颜色** 的改正通常称为 **红化改正**。', '小知识'],
      ['p', '红化系数修正公式：'],
      ['formula', 'm_{λ,0} = m_{λ,obs} − A_{λ} = m_{λ,obs} − R_{λ} E(B−V)'],
      ['formula', '(a−b)_{0} = (a−b)_{obs} − E(a−b) = (a−b)_{obs} − R_{(a−b)} E(B−V)'],
      ['p', '其中：'],
      ['ul', ['m_{λ,obs} / (a−b)_{obs}：观测得到的视星等或色指数', 'R_{λ} / R_{(a−b)}：该波段或色指数的红化系数']],
      ['p', `推荐红化系数：[Zhang et al. (2024)](${ZHANG2024_URL})（更普适）/ [Zhang et al. (2023)](${ZHANG2023_URL})（适用范围较窄，但精度更高）`],
      ['h2', 'Zhang et al. (2024)'],
      ['p', `[Zhang et al. (2024)](${ZHANG2024_URL}) 基于 Gaia DR3 与 LAMOST DR7 中约 **500 万个共同源** 的 Gaia XP 光谱，采用恒星配对法对银河系消光曲线进行了直接测量，并利用其中约 **37 万个高质量光谱** 构建了银河系中值消光曲线。`],
      ['p', '您可以在网站中使用 Zhang et al. (2024) 提供的中值消光曲线，快速估算某一波段的消光值或某一色指数的红化量。只需：'],
      ['ol', ['选择 **消光改正** 或 **红化改正** 模式', '选择波段或色指数', '输入 E(B−V) 和有效温度']],
      ['p', '系统将基于 Zhang et al. (2024) 的消光曲线，计算并返回对应的 [R_{λ} 和 A_{λ}] 或 [R_{(a−b)} 和 E(a−b)]。'],
      ['note', '对于不熟悉消光建模或无需高精度结果的用户，若仅需快速获取一个可用的平均红化系数，我们推荐使用以下典型默认参数进行估算（或根据您的数据集设定大致的平均 E(B−V) 与 Teff）：E(B−V) = 0.3 mag（Gaia XP 光谱恒星的中值消光）；Teff = 5500 K（类太阳恒星有效温度）。在此条件下计算得到的红化系数可作为合理的平均值，适用于初步分析、快速估算或粗略校正。若需进阶的高精度结果，建议结合目标源的实际 E(B−V) 和 Teff 值进行逐源计算。', '特别提醒：快速估算红化系数'],
      ['toolbox', '2024'],
      ['p', `如果需要使用更广泛的波段（Zhang et al. (2024) 支持上传任意滤波片响应曲线）或批量计算，可以使用 [Zhang et al. (2024), ApJ, 972, 207](${ZHANG2024_URL}) 提供的 [XP_Extinction_Toolkit](${XP_TOOLKIT_URL})。`],
      ['h2', 'Zhang et al. (2023)'],
      ['p', `Zhang et al. (2024) 的估计是基于 BOSZ 光谱库、滤光片通带和实测消光曲线的，属于理论与实测结合的计算，可能会和纯实测结果有所不同。当需要计算 GALEX、PS1、SDSS、Gaia、2MASS 和 WISE 波段的消光（或红化）时，并且 E(B−V) 与 Teff 范围在 0–0.5 mag 和 4000–10000 K 时，我们推荐使用 [Zhang et al. (2023)](${ZHANG2023_URL}) 基于实测的消光系数包 [extinction_coefficient](${EXT_COEF_URL}) 来进行消光改正。`],
      ['p', `[Zhang et al. (2023), ApJS, 264, 14](${ZHANG2023_URL}) 不支持自定义响应曲线。如果您的测光系统在以下包含，且目标源的 E(B−V) 和 Teff 落在 0–0.5 mag 与 4000–10000 K 范围内，我们推荐使用该论文发布的 **经验性尘埃消光与红化系数**，并通过其开源 Python 工具包 \`extinction_coefficient\` 进行快速计算。`],
      ['note', 'Zhang & Yuan (2023) 的系数基于 SFD 图构建，本 3D 消光图所提供的 E(B–V)，需乘以 1/0.834 后输入 `extinction_coefficient` 包，以修正与 SFD 的系统性差异（详见 Wang et al. 2025 图 17）。', '重要使用说明'],
      ['toolbox', '2023'],
    ],
    toolbox: {
      '2024': { title: '快速工具箱 · 2024（中值消光曲线）', cite: `如若使用到此红化系数，请引用 [Zhang et al. (2024)](${ZHANG2024_URL})，DOI: [10.3847/1538-4357/ad613e](https://doi.org/10.3847/1538-4357/ad613e)` },
      '2023': {
        title: '快速工具箱 · 2023（经验系数包）',
        cite: `如若使用到此红化系数，请引用 [Zhang et al. (2023)](${ZHANG2023_URL})，DOI: [10.3847/1538-4365/ac9dfa](https://doi.org/10.3847/1538-4365/ac9dfa)`,
        note: '若 E(B−V) 来源于本 3D 消光图，请在输入该工具箱前先乘以 1/0.834 再计算，以修正与 SFD 的系统性差异。',
      },
      tabs: { '2024': '2024 工具箱', '2023': '2023 工具箱', guide: '方法说明' },
      modeExt: '消光改正',
      modeRed: '红化改正',
      pick: '选择波段 / 颜色',
      pickHintExt: '点选 1 个波段',
      pickHintRed: '依次点选 2 个波段，组成颜色 a − b',
      teff: 'Teff (K)',
      calc: '计算',
      errPick: '请先选择波段（红化改正需要两个）。',
      errEbv: 'E(B−V) 须 ≥ 0，Teff 须 ≥ 1000 K。',
    },
  },
  en: {
    docs: [
      ['p', 'An all-sky 3D dust extinction map built from Gaia and LAMOST.'],
      ['ul', [
        `GitHub: [Grapeknight/dustmaps3d](${PACKAGE_REPO_URL})`,
        `Wang et al. (2025), An all-sky 3D dust map based on Gaia and LAMOST · DOI: [10.3847/1538-4365/adea39](${PAPER_DOI_URL})`,
        `A Python package for easy access to the 3D dust map · DOI: [10.12149/101619](${PACKAGE_DOI_URL})`,
      ]],
      ['h2', 'Installation'],
      ['p', 'Install with pip:'],
      ['code', 'pip install dustmaps3d'],
      ['h2', 'Data file'],
      ['note', 'The package itself ships without the data. On first use it automatically downloads the ~400 MB model data file from GitHub or NADC.'],
      ['h3', 'Automatic download'],
      ['ul', [
        'Calling `dustmaps3d()` automatically tries to download the data file `data_v3.fits.gz`;',
        'once downloaded it is unpacked to `data_v3.fits` and cached locally;',
        'later calls read the cache directly, with no further download.',
      ]],
      ['p', `Users in China are detected automatically and download from the National Astronomical Data Center first, no VPN needed: [NADC](${DATA_NADC_URL})`],
      ['p', `If that fails, the backup source is used: [GitHub Releases](${DATA_GITHUB_URL})`],
      ['p', 'On systems not set to Chinese the order is reversed and GitHub is tried first.'],
      ['h3', 'If the download fails'],
      ['p', 'If the download fails (for example with a connect timeout), you can download the data file by hand and put it in the cache directory:'],
      ['ol', [
        `Open a mirror: in China, [NADC](${DATA_NADC_URL}); elsewhere, [GitHub Releases](${DATA_GITHUB_URL})`,
        'Download `data_v3.fits.gz`',
        'Unpack it to get `data_v3.fits`',
        'Put it in the local cache directory (the first call prints the path in the terminal)',
      ]],
      ['p', 'Example path (Windows):'],
      ['code', PATH_WIN_EN],
      ['p', 'Example path (Linux/macOS):'],
      ['code', PATH_NIX_EN],
      ['h2', 'Usage'],
      ['code', SINGLE],
      ['p', 'Batch processing a FITS file:'],
      ['code', FITS_BATCH],
      ['p', 'Batch processing a CSV file:'],
      ['code', CSV_BATCH],
      ['h2', 'For advanced users'],
      ['p', 'For compatibility and ease of use, this dustmaps3d makes some trade-offs, giving up a little performance so that it runs reliably in a wide range of environments.'],
      ['p', `If you need more performance (multi-process parallel computation, command-line use, faster loading and I/O, and so on), try the implementation by developer SunnyHina: [SunnyHina/dustmaps3d](${FAST_PACKAGE_URL}). It uses a more modern data-loading scheme and suits advanced users doing large batch processing.`],
      ['h2', 'Function reference'],
      ['p', '`dustmaps3d(l, b, d)`: returns the dust extinction for the given Galactic coordinates (l, b) and distance d.'],
      ['table', ['Input', 'Type', 'Description', 'Unit'], [
        ['l', 'np.ndarray', 'Galactic longitude', 'deg'],
        ['b', 'np.ndarray', 'Galactic latitude', 'deg'],
        ['d', 'np.ndarray', 'Distance', 'kpc'],
      ]],
      ['table', ['Output', 'Type', 'Description', 'Unit'], [
        ['EBV', 'np.ndarray', 'E(B–V) extinction', 'mag'],
        ['dust', 'np.ndarray', 'Dust density (d(EBV)/dx)', 'mag/kpc'],
        ['sigma', 'np.ndarray', 'Estimated uncertainty of E(B–V)', 'mag'],
        ['max_d', 'np.ndarray', 'Maximum reliable distance along each sightline', 'kpc'],
      ]],
      ['ul', [
        'NaN values in d are replaced by the maximum reliable distance (max_d) of that sightline.',
        'A d beyond max_d lies outside the reliable range of the model; the returned values are extrapolated and not reliable.',
      ]],
      ['h2', 'Performance'],
      ['ul', ['Fully vectorised with NumPy', 'On an ordinary personal computer, a single thread processes **one hundred million stars** in about 100 seconds']],
      ['h2', 'Reddening coefficients'],
      ['p', 'Once E(B−V) is known, observed magnitudes or colours usually need an extinction (reddening) correction to recover a star’s intrinsic brightness or colour. For any band or colour, the key is its reddening coefficient R_{λ} or R_{(a−b)}.'],
      ['p', '[Reddening coefficients](#open:reddening) explains how to obtain them in detail and offers online calculators: enter the parameters and get the coefficient you need.'],
      ['h2', 'Citation'],
      ['p', 'If you use this work or the package in your research, please cite both:'],
      ['ol', [
        `Wang, T. et al. (2025), An all-sky 3D dust map based on Gaia and LAMOST · DOI: [10.3847/1538-4365/adea39](${PAPER_DOI_URL})`,
        `dustmaps3d: A Python package for easy access to the 3D dust map · DOI: [10.12149/101619](${PACKAGE_DOI_URL})`,
      ]],
      ['h2', 'License'],
      ['p', 'MIT License'],
      ['h2', 'Contact'],
      ['p', `For questions, suggestions or technical discussion, open a [GitHub issue](${PACKAGE_REPO_URL}/issues) or email the authors:`],
      ['ul', [
        'Prof. Yuan Haibo: [yuanhb@bnu.edu.cn](mailto:yuanhb@bnu.edu.cn)',
        'Wang Tao: [wt@mail.bnu.edu.cn](mailto:wt@mail.bnu.edu.cn)',
      ]],
    ],
    reddening: [
      ['p', 'With E(B−V) in hand you can correct an observed colour for reddening ((B−V)_{0} = (B−V)_{obs} − E(B−V)) and recover the star’s intrinsic colour. But E(B−V) is only the colour excess in B−V; to correct other bands (G, J, V, …) or colours (BP−RP, V−K, …) you also need the ratio between that band’s extinction and E(B−V) — the reddening coefficient.'],
      ['note', 'Correcting the magnitude in a given **band** is usually called an **extinction correction**; correcting a given **colour** is a **reddening correction**.', 'Good to know'],
      ['p', 'Correction formulas:'],
      ['formula', 'm_{λ,0} = m_{λ,obs} − A_{λ} = m_{λ,obs} − R_{λ} E(B−V)'],
      ['formula', '(a−b)_{0} = (a−b)_{obs} − E(a−b) = (a−b)_{obs} − R_{(a−b)} E(B−V)'],
      ['p', 'where:'],
      ['ul', ['m_{λ,obs} / (a−b)_{obs}: the observed apparent magnitude or colour', 'R_{λ} / R_{(a−b)}: the reddening coefficient of that band or colour']],
      ['p', `Recommended coefficients: [Zhang et al. (2024)](${ZHANG2024_URL}) (more general) / [Zhang et al. (2023)](${ZHANG2023_URL}) (narrower range, higher precision)`],
      ['h2', 'Zhang et al. (2024)'],
      ['p', `[Zhang et al. (2024)](${ZHANG2024_URL}) measured the Milky Way extinction curve directly with the star-pair method, using Gaia XP spectra of about **5 million sources** common to Gaia DR3 and LAMOST DR7, and built a median Galactic extinction curve from about **370,000 high-quality spectra** among them.`],
      ['p', 'You can use this median extinction curve here to quickly estimate the extinction in a band or the reddening of a colour. Simply:'],
      ['ol', ['choose **extinction correction** or **reddening correction**', 'choose a band or colour', 'enter E(B−V) and the effective temperature']],
      ['p', 'The calculator evaluates the Zhang et al. (2024) extinction curve and returns [R_{λ} and A_{λ}] or [R_{(a−b)} and E(a−b)].'],
      ['note', 'If you are not familiar with extinction modelling or do not need high precision and just want a usable average coefficient, we recommend these typical defaults (or rough averages of E(B−V) and Teff for your sample): E(B−V) = 0.3 mag (the median extinction of stars with Gaia XP spectra); Teff = 5500 K (a Sun-like star). Coefficients computed this way are reasonable averages for preliminary analysis, quick estimates or rough corrections. For high-precision work, compute them star by star from each source’s own E(B−V) and Teff.', 'Tip: a quick average coefficient'],
      ['toolbox', '2024'],
      ['p', `For more bands (Zhang et al. (2024) accepts any filter response curve) or batch computation, use the [XP_Extinction_Toolkit](${XP_TOOLKIT_URL}) released with [Zhang et al. (2024), ApJ, 972, 207](${ZHANG2024_URL}).`],
      ['h2', 'Zhang et al. (2023)'],
      ['p', `The Zhang et al. (2024) values come from the BOSZ spectral library, filter passbands and the measured extinction curve — a mix of theory and measurement that can differ from purely empirical results. For extinction (or reddening) in the GALEX, PS1, SDSS, Gaia, 2MASS and WISE bands, with E(B−V) within 0–0.5 mag and Teff within 4000–10000 K, we recommend the empirical coefficient package [extinction_coefficient](${EXT_COEF_URL}) of [Zhang et al. (2023)](${ZHANG2023_URL}).`],
      ['p', `[Zhang et al. (2023), ApJS, 264, 14](${ZHANG2023_URL}) does not take custom response curves. If your photometric system is listed below and your sources have E(B−V) and Teff within 0–0.5 mag and 4000–10000 K, we recommend the paper’s **empirical dust extinction and reddening coefficients**, computed quickly with its open-source Python package \`extinction_coefficient\`.`],
      ['note', 'The Zhang & Yuan (2023) coefficients are built on the SFD map. Multiply the E(B–V) from this 3D map by 1/0.834 before passing it to `extinction_coefficient`, to correct the systematic offset from SFD (see Wang et al. 2025, Fig. 17).', 'Important'],
      ['toolbox', '2023'],
    ],
    toolbox: {
      '2024': { title: 'Quick toolbox · 2024 (median extinction curve)', cite: `If you use these coefficients, please cite [Zhang et al. (2024)](${ZHANG2024_URL}), DOI: [10.3847/1538-4357/ad613e](https://doi.org/10.3847/1538-4357/ad613e)` },
      '2023': {
        title: 'Quick toolbox · 2023 (empirical coefficients)',
        cite: `If you use these coefficients, please cite [Zhang et al. (2023)](${ZHANG2023_URL}), DOI: [10.3847/1538-4365/ac9dfa](https://doi.org/10.3847/1538-4365/ac9dfa)`,
        note: 'If your E(B−V) comes from this 3D map, multiply it by 1/0.834 before entering it here, to correct the systematic offset from SFD.',
      },
      tabs: { '2024': '2024 toolbox', '2023': '2023 toolbox', guide: 'Method' },
      modeExt: 'Extinction',
      modeRed: 'Reddening',
      pick: 'Band / colour',
      pickHintExt: 'pick one band',
      pickHintRed: 'pick two bands in turn to form the colour a − b',
      teff: 'Teff (K)',
      calc: 'Compute',
      errPick: 'Pick a band first (two for a reddening correction).',
      errEbv: 'E(B−V) must be ≥ 0 and Teff ≥ 1000 K.',
    },
  },
};
