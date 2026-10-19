// "How to use" panel content for each tool modal. The design's copy, except query, plot and
// batch (rewritten for the backend's capabilities) and bcp (new).

export const TOOL_DOCS = {
  zh: {
    query: {
      intro: '输入一个视线方向与日心距离，立即得到沿该方向、积分到该距离处的累积消光 E(B−V)、不确定度、尘埃密度与该方向的最大可信距离。',
      steps: [
        [
          '选择坐标系',
          '银道 (l, b) 或赤道 (RA, Dec)，单位均为度。',
        ],
        [
          '填写距离 d',
          '单位 kpc，对应积分到的日心距离；留空则取该方向的最大可信距离。',
        ],
        [
          '运行查询',
          '得到 E(B−V) 与 σ、尘埃密度 dE/dx 与最大可信距离。',
        ],
      ],
      caveats: [
        '距离超过该方向的最大可信距离时为外推值，不具可信度。',
        '高银纬（|b|>30°）尘埃稀薄，E(B−V) 与 σ 都很小。',
        'σ 为 E(B−V) 的不确定度估计，按距离分段取值（与 Python 包一致）。',
      ],
    },
    plot: {
      intro: '设定天区、距离区间与绘图参数，由后端绘制该距离区间内的平均尘埃密度天图。',
      steps: [
        [
          '选择投影',
          '笛卡尔投影填坐标系与经纬范围；正射投影填中心坐标与视场 FOV；斜剖面投影填切片方向角、偏移与半厚度（见下）。',
        ],
        [
          '设定距离区间',
          '图上为 d_min–d_max 之间的平均尘埃密度 ΔE(B−V)/Δd（mag/kpc）；区间中点超过最大可信距离的方向留空。',
        ],
        [
          '调整参数并生成',
          '高斯核 σ、颜色编码范围、颜色缩放（hist / linear / log）与颜色映射，点“生成消光图”。',
        ],
      ],
      caveats: [
        '颜色缩放为 log 时，颜色编码范围的最小值须大于 0。',
        '天区越大出图越慢，全天图需要十几秒；图片可在新窗口打开或下载 PNG。',
        '斜剖面投影：在以太阳为原点的银心坐标（X 指向银心、Y 指向银河旋转方向，单位 kpc）里取一张竖直切面，其水平方向与 X 轴夹角 θ，与太阳的垂直距离为 offset；只用切面两侧半厚度内的格点，数据范围 |X|,|Y| ≤ 3 kpc、|Z| ≤ 1 kpc。横轴 T 从太阳在切面上的垂足（原点 +）量起。',
        '超级气泡截面为超级气泡拟合参数表中 30 个超级气泡与该切面的交线，标注 SB 编号。',
      ],
    },
    batch: {
      intro: '一次粘贴多条视线或上传星表文件，逐行返回 E(B−V)、σ、尘埃密度与最大可信距离，结果可导出。',
      steps: [
        [
          '粘贴或上传',
          '粘贴：每行 “coord1, coord2, d”，逗号或空格分隔；上传：CSV 或 FITS 二进制表。',
        ],
        [
          '选择坐标系',
          '粘贴时在上方切换银道或赤道；上传文件按列名（l,b,d 或 ra,dec,d）自动识别。',
        ],
        [
          '运行',
          '粘贴的结果显示在表格中并可下载 CSV；上传的文件直接返回同格式结果文件。',
        ],
      ],
      caveats: [
        '单次最多 10 万行、20 MB（本机后端的默认上限）。',
        'd 留空时取该方向的最大可信距离；d 超过最大可信距离的结果为外推值。',
      ],
    },
    bcp: {
      intro: '围绕一个视线方向，按气泡直径和距离区间绘制近 / 中 / 远三联正射天区图，并给出气泡内盘与外环的尘埃密度–距离分析。',
      steps: [
        [
          '设定中心与直径',
          '银经 l、银纬 b 与气泡角直径；视场取直径的 2.5 倍（最大 180°）。',
        ],
        [
          '选择距离区间',
          '中图为 d_min–d_max；左右两图为向近处、远处各平移一个区间宽度。',
        ],
        [
          '生成并下载',
          '三图合成后可下载；下方为内盘与外环的尘埃密度随距离变化及峰值定位。',
        ],
      ],
      caveats: [
        'd_min 须大于 0。',
        '直径过大时分析图的采样会超过上限，需要减小直径。',
      ],
    },
    tools: {
      intro: '三件常用的天文换算小工具：坐标换算、角尺度与物理尺度互算、以及视星等与绝对星等换算。',
      steps: [
        [
          '坐标换算',
          '在赤道 / 银道 / 黄道 / 直角坐标间互转，结果可“发送到消光查询”。',
        ],
        [
          '角尺度 ↔ 物理尺度',
          '由距离与物理直径求角直径，或由角直径反推物理尺度。',
        ],
        [
          '星等换算',
          '由视星等、距离（或视差）和消光求绝对星等，或反过来求视星等、求距离；消光可手动填写，也可按位置与距离从本三维消光图查询 E(B−V)，再用 Zhang et al. (2024) 工具箱换算成所选波段的消光。',
        ],
      ],
      caveats: [
        '坐标采用 ICRS J2000、黄赤交角 ε=23.4393°；XYZ 为日心直角坐标。',
        '星等换算：视差按 d = 1000 / ϖ 换算，未做偏差改正；求距离时不能查询消光图。',
      ],
    },
  },
  en: {
    query: {
      intro: 'Enter one line of sight and a heliocentric distance to instantly get the cumulative extinction E(B−V) integrated to that distance, its uncertainty, the dust density and the sightline’s maximum reliable distance.',
      steps: [
        [
          'Pick a frame',
          'Galactic (l, b) or Equatorial (RA, Dec), both in degrees.',
        ],
        [
          'Set distance d',
          'In kpc — the heliocentric distance to integrate to; leave it blank to use the sightline’s maximum reliable distance.',
        ],
        [
          'Run query',
          'Returns E(B−V) with σ, the dust density dE/dx and the maximum reliable distance.',
        ],
      ],
      caveats: [
        'Beyond the sightline’s maximum reliable distance the results are extrapolated and not reliable.',
        'At high latitude (|b|>30°) dust is thin, so E(B−V) and σ are small.',
        'σ is the estimated uncertainty of E(B−V), chosen by distance bin as in the Python package.',
      ],
    },
    plot: {
      intro: 'Set the sky region, a distance shell and plot parameters; the backend draws the mean dust density in that shell.',
      steps: [
        [
          'Pick a projection',
          'Cartesian takes a frame and longitude/latitude ranges; orthographic takes a centre and a field of view; the oblique slice takes a direction, an offset and a half-thickness (see below).',
        ],
        [
          'Set the distance shell',
          'The map shows the mean dust density ΔE(B−V)/Δd (mag/kpc) between d_min and d_max; directions whose shell midpoint lies beyond the reliable distance are left blank.',
        ],
        [
          'Tune & generate',
          'Gaussian σ, color range, color scale (hist / linear / log) and colormap, then “Generate map”.',
        ],
      ],
      caveats: [
        'With a log color scale the color-range minimum must be above 0.',
        'Larger regions take longer — an all-sky map needs a dozen seconds; open the image in a new tab or download the PNG.',
        'Oblique slice: in Sun-centred Galactic coordinates (X towards the Galactic centre, Y along rotation, kpc) it cuts a vertical plane whose horizontal direction makes angle θ with X and which lies offset kpc from the Sun; only grid cells within the half-thickness are used, over |X|,|Y| ≤ 3 kpc and |Z| ≤ 1 kpc. T is measured from the foot of the perpendicular from the Sun (the + origin).',
        'Superbubble cross-sections are where the 30 fitted superbubbles in the parameter table meet the slice, labelled with their SB numbers.',
      ],
    },
    batch: {
      intro: 'Paste many lines of sight or upload a catalogue and get E(B−V), σ, dust density and maximum reliable distance row by row, ready to export.',
      steps: [
        [
          'Paste or upload',
          'Paste: one “coord1, coord2, d” per line, comma- or space-separated; upload: a CSV or FITS binary table.',
        ],
        [
          'Pick a frame',
          'For pasted rows use the toggle above; uploaded files are recognised by their columns (l,b,d or ra,dec,d).',
        ],
        [
          'Run',
          'Pasted rows fill the table and download as CSV; an uploaded file comes back as a result file of the chosen format.',
        ],
      ],
      caveats: [
        'Up to 100,000 rows / 20 MB per run (the local backend’s default limits).',
        'A blank d uses the sightline’s maximum reliable distance; a d beyond it gives extrapolated values.',
      ],
    },
    bcp: {
      intro: 'Around one sightline, draws orthographic maps of three distance shells — near, middle and far — for a given bubble diameter, plus a dust-density-versus-distance analysis of the bubble’s inner disk and annulus.',
      steps: [
        [
          'Set centre & diameter',
          'Galactic l, b and the bubble’s angular diameter; the field of view is 2.5× the diameter (at most 180°).',
        ],
        [
          'Choose the distance shell',
          'The middle panel is d_min–d_max; the side panels are the same width just in front and just behind.',
        ],
        [
          'Generate & download',
          'The three panels are joined into one downloadable figure; below it, the inner-disk and annulus density profiles and the peak position.',
        ],
      ],
      caveats: [
        'd_min must be greater than 0.',
        'Very large diameters exceed the analysis sample limit; reduce the diameter.',
      ],
    },
    tools: {
      intro: 'Three handy converters: coordinate transforms, angular ↔ physical size, and apparent ↔ absolute magnitude.',
      steps: [
        [
          'Coordinate convert',
          'Between Equatorial / Galactic / Ecliptic / Cartesian; send the result straight to a query.',
        ],
        [
          'Angular ↔ physical size',
          'Get angular diameter from distance + physical size, or invert it.',
        ],
        [
          'Magnitudes',
          'Get the absolute magnitude from the apparent magnitude, distance (or parallax) and extinction, or solve for the apparent magnitude or the distance. Enter the extinction by hand, or look up E(B−V) in this 3D dust map at a position and distance and turn it into the chosen band’s extinction with the Zhang et al. (2024) toolbox.',
        ],
      ],
      caveats: [
        'Conventions: ICRS J2000, obliquity ε=23.4393°; XYZ is heliocentric.',
        'Magnitudes: parallax is converted as d = 1000 / ϖ without bias correction; the map lookup is unavailable when solving for distance.',
      ],
    },
  },
};
