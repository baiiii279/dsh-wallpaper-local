// Extract main texture JPEGs from Wallpaper Engine scene.pkg (PKGV container).
// Each scene.pkg contains a .tex (TEXV0005) whose data embeds JPEGs; the first
// JPEG is the full-res wallpaper artwork. Output: pkg/<folderId>.jpg + thumbs.
// Paths default to the Steam registry / DSH home; override via env:
//   WALLPAPER_ROOT, WALLPAPER_WORK
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const DSH_HOME = process.env.DSH_HOME || (process.env.USERPROFILE ? process.env.USERPROFILE + '/.dsh' : '.')
const WORK = process.env.WALLPAPER_WORK || DSH_HOME + '/wallpaper-data'
const ROOT = process.env.WALLPAPER_ROOT || 'D:/steam/steamapps/workshop/content/431960'
const OUT = WORK + '/pkg'
const THUMBS = WORK + '/thumbs'
const META = WORK + '/pkg-meta.json'

fs.mkdirSync(OUT, { recursive: true })

function parsePkg(buf) {
  // header: u32 sigLen(8) + 'PKGVxxxx' + u32 count, then entries:
  // { u32 nameLen, name, u32 offset(from dataStart), u32 size }
  const count = buf.readUInt32LE(12)
  let p = 16
  const entries = []
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt32LE(p)
    const name = buf.toString('latin1', p + 4, p + 4 + nameLen)
    const offset = buf.readUInt32LE(p + 4 + nameLen)
    const size = buf.readUInt32LE(p + 4 + nameLen + 4)
    entries.push({ name, offset, size })
    p += 4 + nameLen + 8
  }
  return { dataStart: p, entries }
}

async function extractMainJpeg(data) {
  // Collect every SOI candidate, then for each try the span to the next SOI
  // and validate with sharp; keep the largest valid JPEG (the main texture).
  const sois = []
  let idx = -1
  while ((idx = data.indexOf(Buffer.from([0xff, 0xd8, 0xff]), idx + 1)) !== -1) sois.push(idx)
  const candidates = []
  for (let i = 0; i < sois.length; i++) {
    const s = sois[i]
    const e = i + 1 < sois.length ? sois[i + 1] : data.length
    const jend = data.lastIndexOf(Buffer.from([0xff, 0xd9]), e)
    if (jend >= s + 4) candidates.push(data.subarray(s, jend + 2))
  }
  // Largest valid JPEG wins (main artwork), ties -> first.
  candidates.sort((a, b) => b.length - a.length)
  for (const c of candidates) {
    try {
      const md = await sharp(c, { failOn: 'none' }).metadata()
      if (md.width > 0 && md.height > 0) return { jpg: c, width: md.width, height: md.height }
    } catch (e) {}
  }
  return null
}

async function main() {
  const meta = []
  let ok = 0, fail = 0
  const dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())
  for (const d of dirs) {
    const folder = path.join(ROOT, d.name)
    const pkgPath = path.join(folder, 'scene.pkg')
    if (!fs.existsSync(pkgPath)) continue
    let title = d.name
    try {
      const pj = JSON.parse(fs.readFileSync(path.join(folder, 'project.json'), 'utf8'))
      if (pj.title) title = pj.title
    } catch (e) {}
    try {
      const buf = fs.readFileSync(pkgPath)
      const { dataStart, entries } = parsePkg(buf)
      const tex = entries.find((en) => en.name.toLowerCase().endsWith('.tex'))
      if (!tex) { console.log('no tex:', d.name); fail++; continue }
      const data = buf.subarray(dataStart + tex.offset, dataStart + tex.offset + tex.size)
      const res = await extractMainJpeg(data)
      if (!res) { console.log('no valid jpeg:', d.name); fail++; continue }
      const { jpg, width, height } = res
      const outPath = path.join(OUT, d.name + '.jpg')
      fs.writeFileSync(outPath, jpg)
      // thumbnail for the picker grid
      await sharp(jpg, { failOn: 'none' })
        .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toFile(path.join(THUMBS, 'pkg__' + d.name + '.jpg'))
      meta.push({ id: d.name, folder: d.name, title, path: outPath, width, height, size: jpg.length })
      ok++
      console.log('OK', d.name, width + 'x' + height, String(title).slice(0, 30))
    } catch (e) {
      fail++
      console.log('FAIL', d.name, e.message)
    }
  }
  fs.writeFileSync(META, JSON.stringify(meta, null, 1))
  console.log('extracted:', ok, '/ failed:', fail)
}

main().catch((e) => { console.error(e); process.exit(1) })
