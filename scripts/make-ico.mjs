import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const buildDir = path.join(__dirname, '..', 'build')
const pngPath = path.join(buildDir, 'icon-256.png')
const icoPath = path.join(buildDir, 'icon.ico')

if (!fs.existsSync(pngPath)) {
  console.error(`PNG no encontrado: ${pngPath}`)
  console.error('Correr antes: powershell -File build/make-icon.ps1')
  process.exit(1)
}

try {
  const buf = await pngToIco([pngPath])
  fs.writeFileSync(icoPath, buf)
  console.log(`ICO generado: ${icoPath}`)
} catch (err) {
  console.error('Error generando ICO:', err)
  process.exit(1)
}
