import sharp from 'sharp'
import { readdir, unlink } from 'fs/promises'
import { join, extname, basename } from 'path'

const DIR = new URL('../public/notes/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

const files = await readdir(DIR)
const images = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f))

let totalBefore = 0, totalAfter = 0

for (const file of images) {
  const src  = join(DIR, file)
  const dest = join(DIR, basename(file, extname(file)) + '.webp')

  const { size: before } = await (await import('fs')).promises.stat(src)
  await sharp(src).webp({ quality: 85 }).toFile(dest)
  const { size: after } = await (await import('fs')).promises.stat(dest)

  totalBefore += before
  totalAfter  += after
  const pct = (((before - after) / before) * 100).toFixed(1)
  console.log(`${file.padEnd(60)} ${(before/1024).toFixed(0).padStart(6)} kB → ${(after/1024).toFixed(0).padStart(5)} kB  (${pct}% 削減)`)
}

console.log('')
console.log(`合計: ${(totalBefore/1024).toFixed(0)} kB → ${(totalAfter/1024).toFixed(0)} kB  (${(((totalBefore-totalAfter)/totalBefore)*100).toFixed(1)}% 削減)`)
