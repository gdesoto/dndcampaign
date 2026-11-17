import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Derive installation artwork from the existing mark; keep maskable content in the safe circle.
const source = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const output = new URL('../public/icons/', import.meta.url)
await mkdir(output, { recursive: true })
for (const [name, size, inset] of [
  ['pwa-192.png', 192, 0],
  ['pwa-512.png', 512, 0],
  ['pwa-maskable-512.png', 512, 72],
  ['apple-touch-icon.png', 180, 0],
]) {
  const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="100%" height="100%" fill="#211712"/>
    <svg x="${inset}" y="${inset}" width="${size - 2 * inset}" height="${size - 2 * inset}" viewBox="0 0 64 64">${source.replace(/<svg[^>]*>|<\/svg>/g, '')}</svg>
  </svg>`
  await sharp(Buffer.from(artwork)).removeAlpha().png().toFile(fileURLToPath(new URL(name, output)))
}
