# dsh-wallpaper-local

把本地 Wallpaper Engine / Steam 壁纸文件夹变成 DSH(DeepSeek Harness)页面背景的插件。带页内挑选器、可调外观、视频背景、以及从 `scene.pkg` 里提取真实壁纸的能力。

> 已发布到 **npm**:`@baiiii/dsh-wallpaper-local`。路径自动解析(Steam 注册表 + DSH home 数据目录),见 [配置](#配置)。

## 功能

- 🖼️ **本地壁纸挑选器**:扫描 `steamapps/workshop/content/431960`(Wallpaper Engine 订阅目录),瀑布流按图片原始比例展示
- 🎬 **视频背景**:识别工坊里的 `.mp4/.webm` 视频壁纸,在 DSH 页面里以 `<video autoplay loop muted>` 播放(HTTP Range 流式,支持 4K 大文件)
- 📦 **场景包纹理提取**:解析 Wallpaper Engine 的 `scene.pkg`(PKGV 容器)→ `TEXV0005` 纹理 → 内嵌 JPEG,提取出真正的横屏高清壁纸
- 🎛️ **外观可调**:壁纸透明度 / 压暗遮罩 / 背景模糊 / 面板玻璃度 四个滑块 + 显示模式(铺满 / 自动 / 完整)+ 智能可读性(按壁纸亮度自动调遮罩)
- 💾 **持久化**:配置存盘(`config.json`)+ localStorage 双保险,重启不丢
- ✨ **精修 UI**:卡片按原始比例瀑布流、悬停细描边、弹窗入场动画、自定义滑杆、SVG 图标

## 安装

```sh
# 方式一:从 npm 安装(推荐)
dsh plugin --profile web add @baiiii/dsh-wallpaper-local

# 方式二:从 GitHub 安装
dsh plugin --profile web add github:baiiii279/dsh-wallpaper-local

# 方式三:本地目录安装(开发)
dsh plugin --profile web add file:C:/path/to/dsh-wallpaper-local

# 方式四:手动放入 profile
# 把整个目录复制到 ~/.dsh/profiles/web/node_modules/@baiiii/dsh-wallpaper-local/
# 并在 ~/.dsh/profiles/web/cordis.patch.yml 加入:
# - insert:
#     - id: dsh-wallpaper-local
#       name: '@baiiii/dsh-wallpaper-local'
```

然后**重启 dsh web**(组合级插件需要重启生效)。

## 首次使用准备(可选但推荐)

插件开箱即用(能列出文件夹里的图片与视频),但要获得完整体验,建议运行一次预生成脚本(`tools/`)——它们会生成缩略图、图片尺寸/亮度元数据,并从 `scene.pkg` 提取真实壁纸:

```sh
# 需要 Node + sharp(可从 DSH profile 的 node_modules 引用,或 npm i -g sharp)
node tools/make-thumbs.js    # 生成缩略图 + meta.json(方形/低清过滤依赖它)
node tools/extract-pkgs.js   # 从 scene.pkg 提取壁纸纹理(pkg-meta.json)
```

> 不跑脚本也能用,但:方形/低清图片不会自动过滤、没有分辨率角标、不会有"我的壁纸"里提取的高清图、网格缩略图加载会稍慢。

## 平台与权限

- **平台**:仅 Web profile(`dsh web`)可用;Electron 桌面端(`file://` 加载)不支持。
- **Windows**:自动读 Steam 注册表 + `libraryfolders.vdf` 定位壁纸目录(支持多 Steam 库)。
- **macOS/Linux**:无 `reg` 命令,必须手动在配置里写 `root`(见下)。
- **权限**:插件需要读取壁纸目录(Steam 工坊内容)并写入数据目录(`~/.dsh/wallpaper-data`);视频以 `node:fs` 流式直读,绕过 DSH 文件沙箱。

## 使用

1. 重启后在侧栏底部点图片图标(或 设置 → 壁纸)
2. 挑选器分两组:
   - **我的壁纸**:视频壁纸(▶ 角标)与从 scene.pkg 提取的高清图(带工坊标题)
   - **图片壁纸**:文件夹里的横屏高清图片
3. 悬停卡片只有描边提示,点击应用;底部滑块实时调外观,自动保存

## 工作原理

- **Host**:`webServer` 注册 `/dsh-wallpaper/*` 路由(full/thumb/video/api),`fs` 服务读文件;视频用 `node:fs` 流式 + Range 支持
- **Client**:主题 token 覆盖(`theme.overrideTokens` 让面板半透明)+ `sidebar.footer.action`/`shell.overlay`/`settings.section` 槽位注入 UI
- **scene.pkg 解析**:`PKGV0006` 容器 = `{名称长度, 名称, 偏移, 大小}` 条目表;`.tex` = `TEXV0005`(TEXI 信息区 + TEXB 数据区,内含 JPEG);`tools/extract-pkgs.js` 批量提取
- **持久化**:Host 写 `config.json`(workspace 下),Client 镜像 localStorage

## 目录结构

```
dsh-wallpaper-local/
├── package.json          # dsh.bundle + dsh.client 声明
├── cordis.patch.yml      # 组合补丁(挂载插件行)
├── lib/
│   ├── index.js          # Host 半(路由/枚举/持久化)
│   └── client.js         # Client 半(bundle,__ModuleLoader__ 格式)
├── src/client.js         # Client 源码(esbuild 打包)
└── tools/extract-pkgs.js # 从 scene.pkg 提取壁纸纹理的脚本
```

## 配置

插件路径**自动解析,无需修改代码**:

| 项 | 解析顺序 |
|---|---|
| 壁纸扫描根目录 | ① 插件 `config.root` → ② 自动读 Steam 注册表 `HKCU\Software\Valve\Steam\SteamPath` → ③ 兜底 `D:\steam\...` |
| 数据目录(缩略图/提取/配置) | ① 插件 `config.workDir` → ② `$DSH_HOME/wallpaper-data`(默认 `~/.dsh/wallpaper-data`) |

如需自定义,在 profile 的 `cordis.patch.yml` 里按 id 覆盖:

```yaml
- id: dsh-wallpaper-local
  name: '@baiiii/dsh-wallpaper-local'
  config:
    root: 'E:/SteamLibrary/steamapps/workshop/content/431960'
    workDir: 'C:/Users/you/dsh-wallpaper-data'
```

`tools/extract-pkgs.js` 支持同样的环境变量覆盖:`WALLPAPER_ROOT` / `WALLPAPER_WORK`。

## 已知限制

- `.dxs` 是 DirectX 着色器,浏览器无法渲染(已确认不可用)
- 纯着色器/DXT 纹理的场景壁纸没有内嵌静态图,只能用封面图
- 4K 视频背景较吃 GPU/内存

## License

MIT
