// One-time thumbnail + metadata generation for the DSH wallpaper picker.
// Paths default to the Steam registry / DSH home; override via env:
//   WALLPAPER_ROOT, WALLPAPER_WORK
const fs = require('fs')
const path = require('path')

const DSH_HOME = process.env.DSH_HOME || (process.env.USERPROFILE ? process.env.USERPROFILE + '/.dsh' : '.')
const WORK = process.env.WALLPAPER_WORK || DSH_HOME + '/wallpaper-data'
const ROOT = process.env.WALLPAPER_ROOT || 'D:/steam/steamapps/workshop/content/431960'
const OUT = WORK + '/thumbs'
const META = WORK + '/meta.json'

const sharp = require('sharp')

const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'])

function walk(dir, relBase, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = relBase ? relBase + '/' + entry.name : entry.name
    if (entry.isDirectory()) walk(full, rel, out)
    else if (entry.isFile() && EXTS.has(path.extname(entry.name).toLowerCase())) out.push(rel)
  }
}

function slugOf(rel) {
  return rel.replace(/[\\/]+/g, '__').replace(/[^A-Za-z0-9._-]/g, '_')
}

const files = []
walk(ROOT, '', files)

fs.mkdirSync(OUT, { recursive: true })

async function main() {
  const meta = []
  let done = 0
  for (const rel of files) {
    const full = path.join(ROOT, rel)
    const stat = fs.statSync(full)
    if (stat.size < 50 * 1024) continue
    const slug = slugOf(rel)
    const thumbPath = path.join(OUT, slug + '.jpg')
    let width = 0, height = 0, brightness = null
    try {
      const img = sharp(full, { animated: false, failOn: 'none' })
      const md = await img.metadata()
      width = md.width || 0
      height = md.height || 0
      const small = await sharp(full, { animated: false, failOn: 'none' })
        .resize(24, 24, { fit: 'inside', withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true })
      // average luminance of the 24x24 raw RGB
      const px = small.data
      let sum = 0
      for (let i = 0; i < px.length; i += 3) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
      brightness = Math.round((sum / (px.length / 3)) / 2.55)
      // thumb
      await sharp(full, { animated: false, failOn: 'none' })
        .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#101218' })
        .jpeg({ quality: 72 })
        .toFile(thumbPath)
    } catch (e) {
      console.log('SKIP ' + rel + ' -> ' + e.message)
      continue
    }
    meta.push({ id: slug, name: rel, full, size: stat.size, width, height, brightness })
    done++
  }
  fs.writeFileSync(META, JSON.stringify(meta, null, 1))
  console.log('thumbnails: ' + done + ' / ' + files.length)
  console.log('meta: ' + META)
}

main().catch((e) => { console.error(e); process.exit(1) })
