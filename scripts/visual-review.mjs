import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Run against `npm run dev`. The corpus remains outside the application bundle.
const project = fileURLToPath(new URL('../', import.meta.url))
const corpus = resolve(process.argv[2] || resolve(project, '../TrainingTestCases-master'))
const output = resolve(project, 'docs/visual-review')
const cases = [
  ['c01', 'dexpi 1.3/example pids/C01 DEXPI Reference P&ID/C01V04-VER.EX01.xml'],
  ['c02', 'dexpi 1.3/example pids/C02 Process Column (BASF)/C02V03-VER.EX02.xml'],
  ['c03', 'dexpi 1.3/example pids/C03 Piping (Equinor)/C03V04-VER.EX02.xml'],
  ['e08', 'dexpi 1.3/example pids/E08 ProcessColumn with ColumnSections/E08V01-VER.EX01.xml'],
  ['e01', 'dexpi 1.3/example pids/E01 Tank/E01V02-VER.EX01.xml'],
  ['e01-1.2', 'dexpi 1.2/example pids/E01 Tank/E01V01-ING.EX01.xml'],
  ['e02-1.2', 'dexpi 1.2/example pids/E02 Tank with Nozzles/E02V02-AUD.EX01.xml'],
]
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
const results = []

try {
  await page.goto(process.env.VIEWER_URL || 'http://127.0.0.1:5178')
  await expect(page.locator('.loaded-check')).toBeVisible()
  for (const [name, relative] of cases) {
    const xmlFile = resolve(corpus, relative)
    await page.locator('input[type="file"]').setInputFiles(xmlFile)
    await expect(page.locator('.document-title')).toContainText(basename(xmlFile))
    await expect(page.locator('.canvas-loading')).toHaveCount(0)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const state = await page.evaluate(() => {
      const app = document.querySelector('.app-shell').__vue__
      return { stats: app.model.stats, bounds: app.model.bounds, renderedBounds: app.renderer.allBounds, warnings: app.model.warnings }
    })
    await page.screenshot({ path: resolve(output, `${name}-viewer.png`) })
    if (name === 'c02') await page.screenshot({ path: resolve(project, 'docs/c02-after.png') })
    const result = { file: relative, ...state }
    if (state.stats.primitives) {
      // Compare the real renderer and official SVG on the same declared sheet,
      // with identical dimensions and margins. This bypasses UI chrome only.
      const xml = await readFile(xmlFile, 'utf8')
      const detail = await browser.newPage({ viewport: { width: 1400, height: 990 } })
      await detail.goto(process.env.VIEWER_URL || 'http://127.0.0.1:5178')
      await detail.evaluate(async ({ xml, fileName }) => {
        const { parseDexpi } = await import('/src/lib/dexpi-parser.js')
        const { DiagramRenderer } = await import('/src/lib/diagram-renderer.js')
        document.querySelector('.app-shell').__vue__.renderer.dispose()
        document.body.innerHTML = '<div id="review-canvas" style="width:1400px;height:990px;background:white"></div>'
        document.body.style.margin = '0'
        const renderer = new DiagramRenderer(document.getElementById('review-canvas'))
        const model = parseDexpi(xml, { fileName })
        renderer.gridVisible = false
        renderer.setModel(model)
        renderer.allBounds = { ...model.bounds }
        renderer.fit()
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      }, { xml, fileName: basename(xmlFile) })
      await detail.screenshot({ path: resolve(output, `${name}-sheet.png`) })
      const svgFile = xmlFile.replace(/\.xml$/i, '.svg')
      if (existsSync(svgFile)) {
        const svg = await readFile(svgFile, 'utf8')
        await detail.setContent('<html><body style="margin:0;background:white"><div id="reference" style="width:1400px;height:990px;position:relative"></div></body></html>')
        await detail.evaluate(({ svg, bounds }) => {
          const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
          const element = document.importNode(doc.documentElement, true)
          const scale = Math.min((1400 - 96) / (bounds.maxX - bounds.minX), (990 - 96) / (bounds.maxY - bounds.minY))
          const width = (bounds.maxX - bounds.minX) * scale
          const height = (bounds.maxY - bounds.minY) * scale
          element.setAttribute('width', width)
          element.setAttribute('height', height)
          element.style.cssText = `position:absolute;left:${(1400 - width) / 2}px;top:${(990 - height) / 2}px`
          document.getElementById('reference').appendChild(element)
        }, { svg, bounds: state.bounds })
        await detail.screenshot({ path: resolve(output, `${name}-reference.png`) })
        result.reference = svgFile
      }
      await detail.close()
    }
    results.push(result)
    console.log(`${name}: ${state.stats.nodeCount} nodes, ${state.stats.primitives} primitives, ${state.warnings.length} warnings`)
  }
  expect(errors).toEqual([])
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ browserErrors: errors, cases: results }, null, 2))
} finally {
  await browser.close()
}
