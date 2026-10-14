# 3D Dust Map 网站 · NADC 部署包

把「银河系三维尘埃消光查询平台」（3D Dust Map，Wang et al. 2025）部署到 NADC 服务器。它由两部分组成：一个纯静态网站，以及它调用的 Python 后端 dustmaps3d-backend。部署后网址形如 `https://nadc.china-vo.org/data/dustmaps3d/`。

> **给执行部署的 AI / 工程师**：本文件是自包含的。按第 4 节从上到下执行即可，每一步都给了命令、验证方法和预期结果，不需要向人提问。第 0 节的变量都有默认值：没有人另行指定时直接用默认值。只有遇到第 7 节没覆盖的报错时才需要停下来找人。

---

## 0. 部署变量（都有默认值）

| 变量 | 默认值 | 什么时候要改 | 改了要动哪里 |
| --- | --- | --- | --- |
| 网站路径 PREFIX | `/data/dustmaps3d/` | 与服务器上已有路径冲突，或 NADC 指定了别的路径 | 只改 `deploy/nginx-dustmaps3d.conf`（文件头有一条 sed 命令）。**网站本身不用重新构建。** |
| 安装目录 | `/opt/dustmaps3d` | 服务器规定了别的目录 | 复制前执行 `sed -i 's#/opt/dustmaps3d#/新目录#g' $PKG/deploy/*`，并把第 4 节命令里的 `/opt/dustmaps3d` 换掉 |
| 后端端口 | `58123`（只监听 127.0.0.1） | 本机已有程序占用 58123（例如现网已有一份 dustmaps3d-backend）。检查：`ss -ltn 'sport = :58123'` | `dustmaps3d-backend.service` 里 1 处（`--port`），`nginx-dustmaps3d.conf` 里 2 处（两个 `proxy_pass`），以及第 4 节验证命令里的地址 |
| 运行用户 | `dustmaps` | 服务器规定了服务账号 | `dustmaps3d-backend.service` 的 `User=`/`Group=`、4.11 的 cron 行、第 4 节命令里的 `dustmaps` |

这套部署与 NADC 现有的 `/data/dustmaps/` 站点**完全独立**：使用自己的进程、端口、SQLite 数据库、数据文件和输出目录，不读写现网的任何东西，也不需要现网的数据库。

## 1. 架构

```
浏览器
  │  https://nadc.china-vo.org/data/dustmaps3d/...
  ▼
Nginx（已有的 NADC server 块里新增 6 个 location）
  ├─ /data/dustmaps3d/          → 静态文件 /opt/dustmaps3d/site/
  ├─ /data/dustmaps3d/api/      → http://127.0.0.1:58123/api/    （FastAPI 后端）
  └─ /data/dustmaps3d/files/    → http://127.0.0.1:58123/files/  （后端生成的 PNG）
                                   │
                                   ▼
                     dustmaps3d-backend（systemd 服务，uvicorn，1 个 HTTP worker）
                       ├─ /opt/dustmaps3d/data/data.parquet   模型参数（单点、批量、笛卡尔图、正射图）
                       ├─ /opt/dustmaps3d/data/data_v3.fits   同一模型的 FITS 版（气泡分析）
                       ├─ STILTS（Java）                      绘制正射投影图
                       └─ var/dustmaps.db（SQLite）、var/results/（生成的图片）
```

网站里所有请求都是**相对于页面的地址**（`./api/v2/...`、`./files/...`），所以无论放在哪个路径下，只要 Nginx 在同一路径下转发 `api/` 和 `files/` 就能工作，不需要跨域配置。

网站用到的后端接口：`POST api/v2/dust/query`、`POST api/v2/dust/batch`、`GET api/v2/dust/templates`、`POST api/v2/plots/car`、`POST api/v2/plots/sin`、`POST api/v2/bubbles/analyze`、`POST api/v2/bubbles/schematic`、`POST api/v2/extinction/coefficient`。

## 2. 包内文件

```
dustmaps3d-nadc-deploy/
├── README.md                      本文件
├── site/                          网站成品（已构建，38 MB），原样放到 /opt/dustmaps3d/site/
├── backend/
│   ├── dustmaps3d-backend/        后端源码：github.com/SunnyHina/dustmaps3d-backend 提交 564cfb8，已打上下面的补丁
│   ├── patches/0001-distance-dependent-sigma.patch   σ 补丁（已应用在上面的源码里，仅供查看或回退）
│   └── tools/
│       ├── prepare_data.py        data_v3.fits → data.parquet 转换（逐列校验）
│       └── parity_test.py         可选：后端结果与 pip 包 dustmaps3d 逐点对照
├── deploy/
│   ├── nginx-dustmaps3d.conf      Nginx location 块（放进已有 server 块）
│   ├── dustmaps3d-backend.service systemd 服务
│   ├── env.production             后端配置，复制为 backend/.env
│   ├── cleanup-results.sh         每小时删除 24 小时前生成的图片
│   └── smoke_test.sh              部署后端到端验收（11 项检查）
└── site-src/                      网站源码（只在以后要修改网站时才用；部署不需要 Node）
```

**不在包里、部署时下载的东西**：模型数据 `data_v3.fits.gz`（约 400 MB，NADC 自己的下载链接）、STILTS（50 MB，官方网站）、Python 依赖（约 1 GB，PyPI 或国内镜像）。

## 3. 服务器要求

| 项目 | 要求 | 检查命令 |
| --- | --- | --- |
| 系统 | Linux x86_64 或 aarch64 | `uname -m` |
| Python | 3.11 或 3.12（没有的话 uv 会自动安装 3.11） | `python3.11 --version` |
| Java | 11 或更高（STILTS 需要） | `java -version` |
| Nginx | 已在服务 nadc.china-vo.org | `nginx -v` |
| 内存 | **≥ 8 GB 可用**。估算：计算进程要常驻两份模型表（12,582,912 行 × 21 列 float32，各约 1 GB），全天图计算时峰值更高 | `free -g` |
| 磁盘 | ≥ 5 GB：数据 1.5 GB，Python 环境 0.5 GB，STILTS 0.05 GB，生成图片（每小时清理 24 小时前的） | `df -h /opt` |
| 网络（仅部署时） | 能访问 PyPI（或国内镜像）、`www.star.bristol.ac.uk`、`nadc.china-vo.org` | |

## 4. 部署步骤

以下命令都以 root 执行，除非写了 `sudo -u dustmaps`。`$PKG` 指解压后的本包目录。

### 4.1 用户与目录

```bash
PKG=/path/to/dustmaps3d-nadc-deploy          # 改成本包实际解压位置
id dustmaps >/dev/null 2>&1 || useradd --system --home-dir /opt/dustmaps3d --shell /usr/sbin/nologin dustmaps
mkdir -p /opt/dustmaps3d/{data,stilts}
cp -R "$PKG/site"                         /opt/dustmaps3d/site
cp -R "$PKG/backend/dustmaps3d-backend"   /opt/dustmaps3d/backend
cp -R "$PKG/backend/tools"                /opt/dustmaps3d/tools
cp -R "$PKG/deploy"                       /opt/dustmaps3d/deploy
mkdir -p /opt/dustmaps3d/backend/var/{results,matplotlib}
chown -R dustmaps:dustmaps /opt/dustmaps3d
chmod -R o+rX /opt/dustmaps3d/site           # nginx 的运行用户要能读网站文件
chmod o+x /opt/dustmaps3d
```

验证：`ls /opt/dustmaps3d/site/index.html /opt/dustmaps3d/backend/pyproject.toml` 两个文件都存在。

### 4.2 Python 环境（二选一）

**方式 A：uv（推荐，按锁文件安装完全相同的版本）**

```bash
# 装到 /usr/local/bin，让 dustmaps 用户也能用
command -v uv || curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh
cd /opt/dustmaps3d/backend
sudo -u dustmaps env HOME=/opt/dustmaps3d PATH=/usr/local/bin:/usr/bin:/bin uv sync --locked --extra dev
```

系统里没有 Python 3.11 / 3.12 时，uv 会从 GitHub 下载 3.11；下载失败就改用方式 B。

**方式 B：pip（PyPI 慢时用国内镜像）**

```bash
cd /opt/dustmaps3d/backend
sudo -u dustmaps python3.11 -m venv .venv
sudo -u dustmaps .venv/bin/pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
sudo -u dustmaps .venv/bin/pip install -i https://pypi.tuna.tsinghua.edu.cn/simple --no-deps -e .
sudo -u dustmaps .venv/bin/pip install -i https://pypi.tuna.tsinghua.edu.cn/simple httpx     # 只有 4.8 的测试需要
```

验证（两种方式相同）：

```bash
/opt/dustmaps3d/backend/.venv/bin/python -c "import dustmaps_backend, healpy, dustmaps3d, xp_extinction_toolkit, extinction_coefficient; print('ok')"
```

预期输出 `ok`。版本约束不要放宽：`xp-extinction-toolkit==1.0` 要求 `scipy<1.14`，另有 `numpy<2`、`pandas<3`。

### 4.3 下载模型数据

```bash
cd /opt/dustmaps3d/data
sudo -u dustmaps curl -L --fail -o data_v3.fits.gz 'https://nadc.china-vo.org/res/file_upload/download?id=51939'
#   国内外都慢时的备用源: https://github.com/Grapeknight/dustmaps3d/releases/download/v3/data_v3.fits.gz
sudo -u dustmaps gunzip data_v3.fits.gz
ls -l data_v3.fits
```

预期 `data_v3.fits` 为 **1056974400 字节**（约 1.0 GB）。如果 NADC 内部已经有这份文件（它就是 pip 包 dustmaps3d 用的数据），直接复制过来即可。

### 4.4 生成 data.parquet

```bash
sudo -u dustmaps /opt/dustmaps3d/backend/.venv/bin/python /opt/dustmaps3d/tools/prepare_data.py \
  /opt/dustmaps3d/data/data_v3.fits /opt/dustmaps3d/data/data.parquet
```

预期最后一行：`wrote /opt/dustmaps3d/data/data.parquet (517 MB, 12582912 rows, 21 columns)`。转换时内存峰值约 3 GB，耗时约 15 秒到 1 分钟。

### 4.5 安装 STILTS

```bash
cd /opt/dustmaps3d/stilts
sudo -u dustmaps curl -L --fail -o stilts.jar https://www.star.bristol.ac.uk/~mbt/stilts/stilts.jar
cat > stilts <<'EOF'
#!/bin/sh
exec java -Djava.awt.headless=true -jar "$(dirname "$0")/stilts.jar" "$@"
EOF
chmod +x stilts && chown dustmaps:dustmaps stilts
sudo -u dustmaps ./stilts -version | head -3
```

预期输出中有 `This is STILTS`（本包测试用的是 3.5-6）。`java` 不在 `/usr/bin`、`/usr/local/bin` 时，把上面脚本里的 `java` 改成绝对路径（如 `/usr/lib/jvm/java-17/bin/java`）。后端只接受一个可执行文件路径（不能带参数），所以必须用这个包装脚本。

### 4.6 后端配置

```bash
cp /opt/dustmaps3d/deploy/env.production /opt/dustmaps3d/backend/.env
chown dustmaps:dustmaps /opt/dustmaps3d/backend/.env
```

文件里的路径已经指向 `/opt/dustmaps3d/data/...` 和 `/opt/dustmaps3d/stilts/stilts`，按默认安装不需要改。

### 4.7 初始化数据库

```bash
cd /opt/dustmaps3d/backend
sudo -u dustmaps .venv/bin/python -m dustmaps_backend.database init --seed
```

预期输出 `SQLite initialized with demo content`。这是本部署独立的 SQLite 文件 `var/dustmaps.db`，用于后端的操作日志；网站不在里面存任何用户数据。

### 4.8 后端自带测试（可选，约 10 秒）

```bash
cd /opt/dustmaps3d/backend
sudo -u dustmaps env MPLCONFIGDIR=var/matplotlib .venv/bin/python -m unittest discover -s tests
```

预期 `Ran 10 tests ... OK`。

### 4.9 启动后端服务

```bash
cp /opt/dustmaps3d/deploy/dustmaps3d-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now dustmaps3d-backend
sleep 5
curl -s http://127.0.0.1:58123/health/ready; echo
```

预期：

```json
{"status":"ready","database":"connected","datasets":{"dust":true,"slices":false,"dustmaps_fits":true}}
```

`"slices": false` 是正常的：那是本网站不用的斜剖面数据。`dust` 或 `dustmaps_fits` 为 `false` 时，检查 `.env` 里的数据路径，以及 dustmaps 用户能否读这两个文件。

再直接测一遍后端（不经过 Nginx，约 30 秒）：

```bash
sh /opt/dustmaps3d/deploy/smoke_test.sh http://127.0.0.1:58123 --backend-only
```

预期最后一行是 `ALL CHECKS PASSED`。第一次请求要把模型数据载入内存，会多花几秒。

### 4.10 Nginx

1. 在 `http { ... }` 层级（任何 server 块之外，例如 `/etc/nginx/nginx.conf` 的 http 块内或 `/etc/nginx/conf.d/` 下的新文件）加一行，只加一次：
   ```nginx
   limit_req_zone $binary_remote_addr zone=dustmaps3d_api:10m rate=30r/m;
   ```
2. 把 `/opt/dustmaps3d/deploy/nginx-dustmaps3d.conf` 里的全部 `location` 块放进服务 `nadc.china-vo.org` 的那个 `server { ... }`（HTTPS 的那个）。可以直接粘贴，也可以在 server 块里写 `include /opt/dustmaps3d/deploy/nginx-dustmaps3d.conf;`。
3. 检查并重载：
   ```bash
   nginx -t && systemctl reload nginx
   ```

配置要点（文件里都已写好）：`alias` 指向 `/opt/dustmaps3d/site/`；`/api/` 和 `/files/` 反向代理到 127.0.0.1:58123；`proxy_read_timeout 300s`（全天图约 25 秒，尘泡绘一整套约 40 秒）；`client_max_body_size 21m`（批量上传上限 20 MB）；每个 IP 每分钟 30 个 API 请求（允许突发 20 个）；`POST /api/v2/bubbles`（后端的“保存气泡”写库接口，网站不用）返回 403。

### 4.11 定时清理生成的图片

```bash
echo '17 * * * * dustmaps /opt/dustmaps3d/deploy/cleanup-results.sh' > /etc/cron.d/dustmaps3d
chmod 644 /etc/cron.d/dustmaps3d
```

后端不会自己删除生成的 PNG（单张从几十 KB 到约 10 MB）；网站每张图只当场显示一次，所以 24 小时前的可以放心删除。

### 4.12 验收

```bash
sh /opt/dustmaps3d/deploy/smoke_test.sh https://nadc.china-vo.org/data/dustmaps3d
```

预期 11 行 `PASS`，加一行 `PASS  public bubble saving is blocked (403)`，最后一行 `ALL CHECKS PASSED`。这一步经过 Nginx，和浏览器的访问路径完全相同。

然后用浏览器打开 `https://nadc.china-vo.org/data/dustmaps3d/`，人工点一遍：

1. 首页正常显示，背景是可滚动的 3D 银河。
2. 01「消光查询」→ 点示例「Orion · l=209 b=-19 d=0.4」→ E(B−V) 显示 **0.0295 mag**。
3. 01「批量查询」→「示例」→「运行批量」→ 表格出现 6 行。
4. 02「进入工具」→「生成消光图」→ 默认全天图约 25 秒后出现。
5. 03「进入工具」→「示例」→「生成三图并合成」→ 约 40 秒后出现三联图、分析图、示意图和「下载合成图」。
6. 页面底部「资源」区 →「红化系数说明与在线工具箱」→ 2024 工具箱选 G →「计算」→ A(G) = **0.7434 mag**。

## 5. 日常运维

| 操作 | 命令 |
| --- | --- |
| 状态 / 日志 | `systemctl status dustmaps3d-backend`；`journalctl -u dustmaps3d-backend -f` |
| 重启后端 | `systemctl restart dustmaps3d-backend`（改了 `.env` 后需要重启） |
| 更新网站 | 用新的 `dist/` 内容整体替换 `/opt/dustmaps3d/site/`，不用重启任何服务 |
| 更新后端 | 替换 `/opt/dustmaps3d/backend/` 里的源码（保留 `.venv/`、`.env`、`var/`）。如果来自上游 GitHub，先 `git apply` 本包的 σ 补丁，再执行 4.2 的同步命令，然后重启 |
| 内存不够 | 保持 `.env` 里 `DUSTMAPS_COMPUTE_WORKERS=1`；内存 ≥ 16 GB 时可改为 2 以提高并发 |
| 下线 | `systemctl disable --now dustmaps3d-backend`，删除 Nginx 里的 location 块并 reload，删除 `/etc/cron.d/dustmaps3d` 和 `/opt/dustmaps3d` |

后端没有登录功能；同一时间最多受理 4 个计算请求，超出时返回 503 并带 `Retry-After`，网站会提示「后端正忙」。

## 6. 以后要修改网站（不部署也不需要）

需要 Node ≥ 20.19 和 pnpm：

```bash
cd site-src
pnpm install
pnpm test        # 103 项单测
pnpm build       # 产物在 dist/，整体替换服务器上的 /opt/dustmaps3d/site/
```

只有当后端放在另一个域名时，才需要在构建前设置 `VITE_API_BASE=https://后端地址`，并把网站域名加进后端 `.env` 的 `DUSTMAPS_CORS_ORIGINS`。按本文的同域部署不要设置。

## 7. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 页面能打开，工具里提示「无法连接后端服务」 | Nginx 的 `api/` 转发没生效，或后端没在运行 | `curl -s http://127.0.0.1:58123/health/ready`；`curl -s -X POST https://站点/data/dustmaps3d/api/v2/dust/query -H 'Content-Type: application/json' -d '{"coord1":209,"coord2":-19.4,"d":0.4}'` |
| 页面空白，静态文件 404 | 访问的是不带结尾斜杠的 `/data/dustmaps3d`，或 alias 路径少了结尾 `/` | 确认 `location = /data/dustmaps3d { return 301 ...; }` 存在，alias 写成 `/opt/dustmaps3d/site/`（带斜杠） |
| `nginx -t` 报 `zero size shared memory zone "dustmaps3d_api"` | 漏了 http 层级那行 `limit_req_zone` | 见 4.10 第 1 步 |
| 正射图、尘泡绘报 503，提示 “dataset or dependency is unavailable”；笛卡尔图正常 | 后端找不到 STILTS 或 java | `sudo -u dustmaps /opt/dustmaps3d/stilts/stilts -version`；java 路径写进包装脚本，或加到 service 的 `PATH=` |
| 所有查询都报 503 “dataset … unavailable” | `.env` 数据路径不对，或没有读权限 | `/health/ready` 看 `dust`、`dustmaps_fits`；`sudo -u dustmaps ls -l /opt/dustmaps3d/data/` |
| 出图到一半报 504 | Nginx 代理超时太短 | `proxy_read_timeout 300s` |
| 批量上传报 413 | `client_max_body_size` 太小 | 设为 `21m` |
| 报 429 | 触发了限流（每 IP 30 次/分钟） | 正常保护；需要时调整 `limit_req_zone` 的 rate |
| 报 503 “Computation capacity reached” | 同时超过 4 个计算请求 | 稍后重试；或调大 `DUSTMAPS_MAX_PENDING_COMPUTATIONS`（会排队更久） |
| 后端启动后计算请求全部失败，日志有 `BrokenProcessPool` | 用了不带 `if __name__ == "__main__"` 保护的自定义启动脚本，计算子进程（spawn）重复启动服务 | 只用 service 文件里的 `python -m uvicorn ...` 命令 |
| 进程被 OOM 杀掉 | 内存不足 | 确保 ≥ 8 GB 可用，`DUSTMAPS_COMPUTE_WORKERS=1` |
| CentOS/RHEL 上 Nginx 报 502 或 403，但 curl 本地端口正常 | SELinux | `setsebool -P httpd_can_network_connect 1`；`chcon -R -t httpd_sys_content_t /opt/dustmaps3d/site` |

## 8. 与原版仓库和 NADC 现网的差异（需要知道）

- **σ 补丁（已应用）**：原版后端对任何距离都返回整条视线的总 `sigma`。pip 包 dustmaps3d 按距离分段取值：d < 1 kpc 取 min(sigma, sigma_0_2)；1–2 kpc 再加入 sigma_1_4；2–4 kpc 取 min(sigma_1_4, sigma_2_max)；≥ 4 kpc 取 sigma_2_max；后两段缺值时退回 sigma。补丁让后端与 pip 包一致，只改 `dustmaps_backend/science.py` 一处，并新增一条单元测试。要恢复原版行为：在 `/opt/dustmaps3d/backend` 里执行 `git apply -R /path/to/0001-distance-dependent-sigma.patch`（目录不是 git 仓库也能用），然后重启服务。
- **对照结果**（本地 1200 条随机视线）：E(B−V)、σ、最大可信距离与 pip 包一致；尘埃密度相对差 ≤ 4×10⁻⁶，这是 float32 模型数据本身的精度。恰好落在 HEALPix 像素边界上的整数坐标（如 l=90°, b=0°）可能分到相邻像素：后端用 healpy，pip 包用 astropy_healpix；随机坐标不会碰到。复查方法：`.venv/bin/python /opt/dustmaps3d/tools/parity_test.py --base-url http://127.0.0.1:58123`（需要先让 pip 包找到数据：`mkdir -p ~dustmaps/.local/share/dustmaps3d && ln -s /opt/dustmaps3d/data/data_v3.fits ~dustmaps/.local/share/dustmaps3d/`，再以 dustmaps 用户运行）。
- **红化系数**：两套工具箱的结果与 NADC 线上 `/data/dustmaps/toolkit` 逐位一致。
- 网站只用笛卡尔和正射两种投影；斜剖面、正交切片和 3D viewer 的数据没有配置，对应接口返回 503，网站不会调用。
- 02 全天图和 03 尘泡绘画的是 d_min–d_max 区间内的**平均尘埃密度**（mag/kpc），不是累积 E(B−V)。

## 9. 部署完成后

把最终网址告诉网站维护人。GitHub 上的两个 Skill（[CrotRest/dustmaps3d-skills](https://github.com/CrotRest/dustmaps3d-skills) 里的 `dust-sky-map`、`dust-bubble-plot`）会把默认后端地址改成这个网址；在那之前，用户可以自己设置 `DUSTMAPS_API=https://nadc.china-vo.org/data/dustmaps3d`。

## 版本

- 网站：2026-10-14 构建，源码见 `site-src/`（本次更新：联系区加成员贡献；07 加 Citations 引用论文列表；01→02 全天图从太阳处展开；02 改为 0.3–1.8 kpc、论文图色带）。只更新网站时，把 `site/` 整体替换到 `/opt/dustmaps3d/site/` 即可，后端与配置不变
- 后端：SunnyHina/dustmaps3d-backend @ `564cfb8`，加 `0001-distance-dependent-sigma.patch`
- 数据：dustmaps3d `data_v3.fits`（HEALPix Nside = 1024，RING 排序，12,582,912 行）
- 本地验收（macOS，Python 3.11.15，Java 11，STILTS 3.5-6）：后端测试 10/10，前端测试 103/103，`smoke_test.sh` 在模拟的 `/data/dustmaps3d/` 子路径下 11/11 通过。Nginx 配置文件未在真实 Nginx 上做过 `nginx -t`，请在 4.10 步执行。
