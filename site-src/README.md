# 3D Dust Map Platform · 演示站（银河背景版）

> 本目录是 `dust-map-site/` 的美术新版：全站深色、黑白配色、思源宋体（Noto Serif SC），背景换成随滚动推镜的 3D 银河系（Three.js 实时粒子，较差自转）。文案和功能与原版一致；01 的两张功能卡改成了细线横条按钮；02 的 Mollweide 全天图以太阳为原点、从 01 锁定的太阳处展开，粒子由 dustmaps3d 模型直接算出的 0.3–1.8 kpc 尘埃密度驱动，配色沿用论文图的色带，镜头随距离在银河里推进；联系区标注各成员贡献，07 下有引用本工作的论文列表；04 的背景改为“仰望星空·坐标网”。镜头分镜见 `src/components/galaxy/shots.js`，效果截图和录屏在 `preview/`。

Claude Design 设计稿「3D Dust Map Platform.dc.html」的真实代码实现：Vite + React 单页站，中英双语，桌面端按设计稿 1:1 还原，并补齐了平板和手机适配。

工具弹窗里的数值和图片全部来自真实后端 [dustmaps3d-backend](https://github.com/SunnyHina/dustmaps3d-backend)（搭建与启动见 [`backend/README.md`](backend/README.md)）。浏览器里的模拟模型 `src/data/mockModel.js` 只剩一个用途：01 栏目银河背景里悬停演示的 HUD 数字（美术动画）。四个功能各有一个给 AI 助手用的 Skill，源码在 [CrotRest/dustmaps3d-skills](https://github.com/CrotRest/dustmaps3d-skills)，网站上提供复制安装指令。

## 常用命令

需要 Node ≥ 20.19 和 pnpm。

```bash
pnpm install
../dustmaps3d-backend/.venv/bin/python backend/serve.py   # 后端 127.0.0.1:58123（首次搭建见 backend/README.md）
pnpm dev        # 本地开发 http://localhost:5173（项目 launch.json 里的 galaxy-dev 用 5174），/api 与 /files 转发到后端
pnpm test       # 单测（103 项）：设计稿对照 + 后端接口客户端
pnpm build      # 产物输出到 dist/
pnpm preview    # 本地预览 dist/（同样转发到后端）
```

## 部署

`pnpm build` 生成的 `dist/` 是纯静态文件，全部使用相对路径（`base: './'`），放在任意静态托管或任意子目录都能直接运行，已实测过三层子目录。

- **GitHub Pages**：把 `dist/` 的内容推到 `gh-pages` 分支，或在 Actions 里 build 后发布，不需要改配置。
- **Vercel / Netlify**：构建命令 `pnpm build`，输出目录 `dist`。
- **Nginx / 课题组服务器**：把 `dist/` 拷到站点目录即可。`assets/` 下的文件名带内容哈希，可以设长缓存；`index.html` 和 `dustmap/` 建议短缓存。

体积约 38 MB，其中约 29 MB 是思源宋体 4 个字重的分片文件（按 unicode-range 切成约 100 片/字重），浏览器只下载页面实际用到的字的分片，完整滚动一遍约 1.3 MB。其余大头是 02 全天图的数据图集 `dustmap/atlas.png`（约 6 MB，页面加载几秒后或滚近 02 时才下载）。three.js 单独打包、页面文字渲染后再加载（约 144 KB gzip）。字体打包在本地，不依赖 Google Fonts，国内访问不受影响。

## 后端接口

界面上的数值全部经过 `src/data/api.js`，对应 dustmaps3d-backend 的接口：

| 函数 | 接口 | 用在 |
| --- | --- | --- |
| `queryExtinction` | `POST /api/v2/dust/query` | 01 单点查询（E(B−V)、σ、尘埃密度、最大可信距离；d 留空取最大可信距离） |
| `queryBatchFile` / `templateUrl` | `POST /api/v2/dust/batch`、`GET /api/v2/dust/templates` | 01 批量查询（粘贴的文本也转成 CSV 走同一接口） |
| `plotMap` | `POST /api/v2/plots/car`、`/plots/sin` | 02 全天图（笛卡尔 / 正射） |
| `plotMap` + `analyzeBubble` + `bubbleSchematic` | `/plots/sin` ×3、`/bubbles/analyze`、`/bubbles/schematic` | 03 尘泡绘 |
| `extinctionCoefficient` | `POST /api/v2/extinction/coefficient` | 资源 · 红化系数的 2024 / 2023 工具箱 |

后端没启动时，各工具弹窗里会提示“无法连接后端服务”。开发时 Vite 转发 `/api`、`/files`；其它部署方式在构建前设 `VITE_API_BASE`。仓库后端没有的功能已从界面删除：本地泡距离、分子云、E(B−V)–距离曲线、小天区图、示意红化系数表、点图拾取视线、正交与斜剖面投影。

## 目录结构

```
design/              从 Claude Design 导入的设计稿快照（仅作参考，不参与构建）
backend/             本机运行 dustmaps3d-backend 的辅助文件：启动脚本、数据转换、σ 补丁、对照测试（见其中 README）
public/dustmap/      02 的数据：100 个距离切片的 ΔE(B−V) 图集 + 距离表，前端按密度在太阳周围的真实位置撒出 3D 尘埃粒子
scripts/             extract-design-golden.mjs：运行设计稿里的逻辑，生成对照数据
                     extract-dustmap.py：把 dust.mp4 的 Mollweide 帧按色标反解成数值图集
                     build-logo.py：生成站点 logo（src/assets/logo-mark.svg）和 favicon，纯填充路径、无遮罩
src/
  data/              api.js（后端接口）、mockModel.js（只给银河 HUD 演示用）、content.js（静态内容、下载链接、图集、滤光片表）
  assets/gallery/    资源 · 图集的 12 张 WebP 预览（原图在 NADC）
  lib/               坐标变换、格式化、单位换算、批量与绘图请求组装、Skill 安装指令（纯函数）
  i18n/              中英文案、工具说明、文档与红化系数长文（reference.js）
  state/             工具状态（弹窗关掉再打开，输入和结果都还在）
  components/        页面区块、弹窗、五个工具（查询、批量、全天图、尘泡绘、天文小工具）与三个阅读弹窗（文档、红化系数、图集）
  components/galaxy/ 银河背景：model（粒子与较差自转）、shots（滚动→镜头）、shaders、hud（定位/03 扫描线/02 全天图坐标网/星空坐标网/日心极坐标网）、dustCloud（02 的 3D 尘埃云）
tests/               与设计稿的对照单测 + astropy 坐标对照数据 + 后端接口客户端单测
```

查看设计稿原件：

```bash
python3 -m http.server 8801 -d design
```

然后打开 <http://localhost:8801/3D%20Dust%20Map%20Platform.dc.html>。

## 与设计稿的差异

**按约定处理的占位**
- 资源区原本是 9 个 `#` 占位链接；现在是 4 张卡片：数据下载（NADC 镜像、GitHub Releases、PyPI）、红化系数、文档、图集，后三者打开站内阅读弹窗。
- 尘泡绘截图位原本是空的，曾填入 NADC 页面截图；银河背景版里 03 改为左栏文字 + 背景红外银河，截图已去掉（文件仍在 `src/assets/images/`，未打包）。

**修复的设计稿 bug**
- 页面外层 `overflow: hidden` 让顶部导航无法吸顶，改为 `overflow-x: clip`。
- 弹窗被困在 `z-index: 1` 的层叠上下文里，导航会压在遮罩上面；弹窗标题栏同样因为 `overflow: hidden` 不能吸顶。两处都已修复。
- 在坐标工具里“用此银道坐标查询”原本会去操作当时不存在的查询输入框，实际什么也不发生。现在会切换到查询工具、填好坐标并执行查询。（全天图的点图拾取随后端接入一并去掉：后端返回的是图片。）
- 设计稿没有定义校验错误文案（`errEmpty` 等），出错时界面没有任何提示。已补中英文案。
- 坐标工具的 RA 时/分/秒输入框会溢出到输出栏。
- “复制结果”复制出的是字面 `\n`，已改成真正的换行。
- 合作单位跑马灯每 26 秒会跳一下（`gap` 导致 -50% 位移对不齐）。

**新增**
- 平板和手机适配：导航收进菜单按钮，多列布局改单列，弹窗全屏。手机上银河粒子数约为桌面的 1/4。
- 系统开启“减少动态效果”时，银河停止自转，镜头在栏目间直接切换，滚动显现停用。
- 帧率持续低于 30 时自动降级：先降分辨率、再减粒子，最后停转只在滚动时重绘。没有 WebGL 时显示静态渐变背景。
- 打开工具弹窗时银河背景暂停绘制。
- 查询结果在切换语言时跟着切换。
- 弹窗支持 Esc 关闭，Tab 焦点不会跑出弹窗，关闭后焦点回到原位；输入框里按回车即可查询。

## 素材来源

- 设计稿、logo：通过 Claude Design MCP 导入，按字节还原。
- 02 全天图：来自课题组的 `dust.mp4`（银道坐标 Mollweide，ΔE(B−V) [mmag/pc]，400 帧，d = 0.1×200^(n/399) kpc）。`scripts/extract-dustmap.py` 每 4 帧取 1 帧，按图中色标把颜色反解回 log ΔE(B−V)，逆投影到 320×160 的 (l, b) 网格；图上自带的经纬线和经度文字所在像素不参与采样，用邻域取值补齐；灰色（无数据）记为 0。重新生成：

  ```bash
  python3 scripts/extract-dustmap.py ../dust.mp4 public/dustmap/atlas.png public/dustmap/atlas.json
  ```
