// dsh-wallpaper-local — Host half (ESM cordis plugin).
// Serves the wallpaper library over loopback HTTP and persists the
// appearance config (selected wallpaper + sliders) to disk.
import { createReadStream, statSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

export default {
  // Wait for the filesystem and webserver services before activating: without
  // inject the plugin activates at mount, before fs/webServer exist, and
  // apply() would bail with no routes registered.
  inject: ['fs', 'webServer'],
  apply(ctx, cfg) {
    const fs = ctx.get('fs')
    const webServer = ctx.get('webServer')
    if (!fs || !webServer) return

    // ── Path resolution (portable): explicit config > auto-detect > fallback ──
    // Wallpaper Engine's workshop content always lives at
    // <steamLibrary>/steamapps/workshop/content/431960; the library location
    // varies per machine, so we read it from the Steam registry key.
    const WORKSHOP_SUFFIX = 'steamapps\\workshop\\content\\431960'
    function detectSteamRoot() {
      try {
        const out = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8' })
        const m = /SteamPath\s+REG_SZ\s+([^\r\n]+)/i.exec(out)
        if (m && m[1]) {
          const p = m[1].trim().replace(/[\\/]+$/, '') + '\\' + WORKSHOP_SUFFIX
          if (statSync(p, { throwIfNoEntry: false })) return p
        }
      } catch (e) {}
      return null
    }
    const ROOT = (cfg && cfg.root) || detectSteamRoot() || 'D:\\steam\\steamapps\\workshop\\content\\431960'

    // Data lives under the DSH home so it follows the user, not the workspace.
    const DSH_HOME = process.env.DSH_HOME || (process.env.USERPROFILE ? process.env.USERPROFILE + '\\.dsh' : '.')
    const WORK = (cfg && cfg.workDir) || DSH_HOME + '\\wallpaper-data'
    const THUMBS = WORK + '\\thumbs'
    const SCREENS = WORK + '\\screens'
    const PKG_DIR = WORK + '\\pkg'
    const META = WORK + '\\meta.json'
    const PKG_META = WORK + '\\pkg-meta.json'
    const CONFIG = WORK + '\\config.json'
    try {
      mkdirSync(THUMBS, { recursive: true })
      mkdirSync(SCREENS, { recursive: true })
      mkdirSync(PKG_DIR, { recursive: true })
    } catch (e) {}

    // Safe cleanup: drop any stale entries left by an earlier (dynamic)
    // dsh-wallpaper run in the same process.
    try {
      if (webServer.prefixes) {
        webServer.prefixes.delete('/dsh-wallpaper/full')
        webServer.prefixes.delete('/dsh-wallpaper/thumb')
        webServer.prefixes.delete('/dsh-wallpaper/video')
        webServer.prefixes.delete('/dsh-wallpaper/api')
      }
    } catch (e) {}

    const EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']
    const VIDEO_EXTS = ['.mp4', '.webm']
    const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.bmp': 'image/bmp', '.gif': 'image/gif' }
    const VIDEO_MIME = { '.mp4': 'video/mp4', '.webm': 'video/webm' }
    const DEFAULTS = { selected: '884307090__imgs__25.jpg', wallpaperOpacity: 1, maskOpacity: 0.45, blur: 0, panelOpacity: 0.6, fitMode: 'auto' }

    let listPromise = null
    let config = null

    function slugOf(rel) {
      return rel.replace(/[\\/]+/g, '__').replace(/[^A-Za-z0-9._-]/g, '_')
    }
    function extOf(name) {
      const i = name.lastIndexOf('.')
      return i < 0 ? '' : name.slice(i).toLowerCase()
    }
    // Hide non-wallpaper thumbnails: workshop previews, game maps, error
    // Only standalone image wallpapers are quality-gated (square crops and
    // low-res files are hidden); workshop ITEM entries always show.
    function isLowQuality(width, height) {
      if (!width || !height) return false
      const mx = Math.max(width, height)
      if (Math.abs(width - height) <= mx * 0.12) return true
      if (mx < 1024) return true
      return false
    }

    async function buildList() {
      const videos = [] // group V: video wallpapers (.mp4/.webm at item root)
      const items = [] // group P: textures extracted from scene.pkg (real artwork)
      const images = [] // group B: standalone image wallpapers only
      const rootTarget = await fs.resolve(ROOT)

      // Group V: each workshop item's root-level video is a wallpaper.
      const rootEntries = await fs.listDir(rootTarget)
      for (const entry of rootEntries) {
        if (entry.type !== 'directory') continue
        const folderId = entry.name
        const dirPath = fs.processPath(entry.target)
        let title = folderId
        let previewName = null
        let videoPath = null
        let videoExt = null
        let videoSize = 0
        try {
          const pjTarget = await fs.resolve(dirPath + '\\project.json')
          const pjText = await fs.readText(pjTarget)
          const pj = JSON.parse(pjText)
          if (pj && pj.title) title = String(pj.title)
        } catch (e) {}
        const dirEntries = await fs.listDir(entry.target)
        for (const de of dirEntries) {
          if (de.type !== 'file') continue
          const ext = extOf(de.name)
          if (VIDEO_EXTS.indexOf(ext) >= 0 && (de.size === undefined || de.size > 1024 * 1024) && !videoPath) {
            videoPath = fs.processPath(de.target)
            videoExt = ext
            videoSize = de.size || 0
          }
          if (!previewName && /^preview\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(de.name)) previewName = de.name
        }
        if (!videoPath) continue
        videos.push({
          id: 'video__' + folderId,
          name: title,
          path: videoPath,
          ext: videoExt,
          size: videoSize,
          width: 0,
          height: 0,
          brightness: 0,
          kind: 'video',
          folder: folderId,
          thumbSlug: previewName ? slugOf(folderId + '/' + previewName) : null,
        })
      }
      videos.sort((a, b) => a.name.localeCompare(b.name))

      // Group P: full-res artwork pulled out of Wallpaper Engine scene.pkg
      // containers (see .wallpaper/extract-pkgs.js). Titled, high-res, landscape.
      try {
        const pkgMetaTarget = await fs.resolve(PKG_META)
        const text = await fs.readText(pkgMetaTarget)
        const parsed = JSON.parse(text)
        for (const m of parsed) {
          if (!m.width || !m.height || !m.folder) continue
          items.push({
            id: 'pkg__' + m.folder,
            name: m.title || m.folder,
            path: PKG_DIR + '\\' + m.folder + '.jpg',
            ext: '.jpg',
            size: m.size || 0,
            width: m.width,
            height: m.height,
            brightness: 0,
            kind: 'pkg',
          })
        }
      } catch (e) {}

      async function scan(dirTarget, prefix) {
        const entries = await fs.listDir(dirTarget)
        for (const entry of entries) {
          if (entry.type === 'directory') {
            await scan(entry.target, prefix ? prefix + '/' + entry.name : entry.name)
          } else if (entry.type === 'file') {
            const base = entry.name.toLowerCase()
            if (/^preview\./.test(base)) continue
            const ext = extOf(entry.name)
            if (EXTS.indexOf(ext) < 0) continue
            const rel = prefix ? prefix + '/' + entry.name : entry.name
            if (/\/map\//.test(rel.replace(/\\/g, '/')) || /^(map|error)\./.test(base)) continue
            if (entry.size !== undefined && entry.size <= 50 * 1024) continue
            images.push({
              id: slugOf(rel),
              name: rel,
              path: fs.processPath(entry.target),
              ext,
              size: entry.size || 0,
              width: 0,
              height: 0,
              brightness: 0,
              kind: 'image',
            })
          }
        }
      }
      await scan(rootTarget, '')
      images.sort((a, b) => a.name.localeCompare(b.name))

      const all = videos.concat(items, images)
      // Enrich images with dimensions/brightness from the pre-generated metadata file.
      try {
        const metaTarget = await fs.resolve(META)
        const text = await fs.readText(metaTarget)
        const parsed = JSON.parse(text)
        const byId = {}
        for (const m of parsed) byId[m.id] = m
        for (const item of all) {
          if (item.kind !== 'image') continue
          const md = byId[item.id]
          if (md && md.width && md.height) {
            item.width = md.width
            item.height = md.height
            item.brightness = md.brightness || 0
          }
        }
      } catch (e) {}
      for (const item of all) {
        item.hidden = isLowQuality(item.width, item.height)
      }
      return all
    }
    function ensureList() {
      if (!listPromise) listPromise = buildList()
      return listPromise
    }

    async function loadConfig() {
      if (config) return config
      try {
        const target = await fs.resolve(CONFIG)
        const text = await fs.readText(target)
        const parsed = JSON.parse(text)
        config = Object.assign({}, DEFAULTS, parsed)
      } catch (e) {
        config = Object.assign({}, DEFAULTS)
      }
      return config
    }
    async function saveConfig(patch) {
      const current = config || DEFAULTS
      const next = Object.assign({}, current, patch || {})
      try {
        const target = await fs.resolve(CONFIG)
        await fs.writeText(target, JSON.stringify(next, null, 2))
      } catch (e) {}
      config = next
      return config
    }

    async function targetExists(targetPath) {
      try {
        const target = await fs.resolve(targetPath)
        const info = await fs.stat(target)
        return !!info
      } catch (e) {
        return false
      }
    }
    async function serveFile(res, targetPath, mime, maxBytes) {
      const target = await fs.resolve(targetPath)
      const info = await fs.stat(target)
      if (!info) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('not found')
        return
      }
      const bytes = await fs.readBytes(target, undefined, maxBytes)
      res.writeHead(200, { 'content-type': mime, 'cache-control': 'public, max-age=3600', 'content-length': bytes.length })
      res.end(bytes)
    }
    function sendJson(res, status, obj) {
      const body = JSON.stringify(obj)
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) })
      res.end(body)
    }
    function readBody(req) {
      return new Promise((resolve) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
    }

    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/dsh-wallpaper/full',
      handler: async (req, res) => {
        try {
          const id = decodeURIComponent((req.url || '').slice('/dsh-wallpaper/full'.length).replace(/^\//, '').split('?')[0])
          const list = await ensureList()
          let item = null
          for (const w of list) if (w.id === id) item = w
          if (!item) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('not found')
            return
          }
          const screenPath = SCREENS + '\\' + id + '.jpg'
          if (await targetExists(screenPath)) {
            await serveFile(res, screenPath, 'image/jpeg', 8 * 1024 * 1024)
          } else {
            await serveFile(res, item.path, MIME[item.ext] || 'application/octet-stream', 40 * 1024 * 1024)
          }
        } catch (e) {
          try { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('error: ' + (e && e.message)) } catch (_) {}
        }
      },
    }))

    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/dsh-wallpaper/thumb',
      handler: async (req, res) => {
        try {
          const id = decodeURIComponent((req.url || '').slice('/dsh-wallpaper/thumb'.length).replace(/^\//, '').split('?')[0])
          const thumbPath = THUMBS + '\\' + id + '.jpg'
          if (await targetExists(thumbPath)) {
            await serveFile(res, thumbPath, 'image/jpeg', 1024 * 1024)
            return
          }
          const list = await ensureList()
          for (const w of list) {
            if (w.id === id) {
              await serveFile(res, w.path, MIME[w.ext] || 'application/octet-stream', 40 * 1024 * 1024)
              return
            }
          }
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('not found')
        } catch (e) {
          try { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('error: ' + (e && e.message)) } catch (_) {}
        }
      },
    }))

    // Stream video wallpapers with HTTP Range support (browser seeks/loops).
    // Videos are large, so this route streams directly from disk via node:fs
    // instead of buffering through the fs service.
    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/dsh-wallpaper/video',
      handler: async (req, res) => {
        try {
          const folder = decodeURIComponent((req.url || '').slice('/dsh-wallpaper/video'.length).replace(/^\//, '').split('?')[0])
          const list = await ensureList()
          let item = null
          for (const w of list) if (w.kind === 'video' && w.folder === folder) item = w
          if (!item) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('not found')
            return
          }
          const mime = VIDEO_MIME[item.ext] || 'video/mp4'
          const stat = statSync(item.path)
          const total = stat.size
          const range = req.headers.range
          if (range) {
            const m = /bytes=(\d*)-(\d*)/.exec(range)
            let start = m && m[1] ? parseInt(m[1], 10) : 0
            let end = m && m[2] ? parseInt(m[2], 10) : total - 1
            if (isNaN(start) || start < 0) start = 0
            if (isNaN(end) || end >= total) end = total - 1
            if (start > end) {
              res.writeHead(416, { 'content-range': 'bytes */' + total })
              res.end()
              return
            }
            res.writeHead(206, {
              'content-type': mime,
              'content-length': end - start + 1,
              'content-range': 'bytes ' + start + '-' + end + '/' + total,
              'accept-ranges': 'bytes',
              'cache-control': 'public, max-age=3600',
            })
            createReadStream(item.path, { start, end }).pipe(res)
          } else {
            res.writeHead(200, {
              'content-type': mime,
              'content-length': total,
              'accept-ranges': 'bytes',
              'cache-control': 'public, max-age=3600',
            })
            createReadStream(item.path).pipe(res)
          }
        } catch (e) {
          try { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('error: ' + (e && e.message)) } catch (_) {}
        }
      },
    }))

    function itemView(item) {
      if (item.kind === 'video') {
        return {
          id: item.id,
          name: item.name,
          kind: 'video',
          thumb: item.thumbSlug ? '/dsh-wallpaper/thumb/' + item.thumbSlug : '/dsh-wallpaper/thumb/' + item.id,
          full: '/dsh-wallpaper/video/' + item.folder,
          video: '/dsh-wallpaper/video/' + item.folder,
          width: 0,
          height: 0,
          brightness: 0,
        }
      }
      return {
        id: item.id,
        name: item.name,
        kind: item.kind || 'image',
        thumb: '/dsh-wallpaper/thumb/' + item.id,
        full: '/dsh-wallpaper/full/' + item.id,
        width: item.width || 0,
        height: item.height || 0,
        brightness: item.brightness || 0,
      }
    }

    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/dsh-wallpaper/api',
      handler: async (req, res) => {
        try {
          const rest = decodeURIComponent((req.url || '').slice('/dsh-wallpaper/api'.length).replace(/^\//, '').split('?')[0])
          if (rest === 'list') {
            const list = await ensureList()
            const cfg = await loadConfig()
            const visible = []
            for (const w of list) if (!w.hidden) visible.push(w)
            sendJson(res, 200, { items: visible.map(itemView), excluded: list.length - visible.length, config: cfg })
            return
          }
          if (rest === 'config') {
            if ((req.method || 'GET').toUpperCase() === 'POST') {
              const body = await readBody(req)
              let patch = {}
              try { patch = JSON.parse(body) || {} } catch (e) { patch = {} }
              const cfg = await saveConfig(patch)
              sendJson(res, 200, { ok: true, config: cfg })
            } else {
              const cfg = await loadConfig()
              sendJson(res, 200, { ok: true, config: cfg })
            }
            return
          }
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('not found')
        } catch (e) {
          try { sendJson(res, 500, { error: String(e && e.message || e) }) } catch (_) {}
        }
      },
    }))
  },
}
