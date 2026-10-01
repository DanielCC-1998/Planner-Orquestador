// Generates build/icon.png (512 px) from build/icon.svg.
// electron-builder turns the PNG into an .ico when packaging.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync('build/icon.svg')
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng()
writeFileSync('build/icon.png', png)
mkdirSync('src/presentation/assets', { recursive: true })
writeFileSync('src/presentation/assets/logo.svg', svg)
console.log('build/icon.png generated (%d bytes)', png.length)
