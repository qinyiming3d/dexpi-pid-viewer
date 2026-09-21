import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const referenceFile = fileURLToPath(new URL('../public/samples/C01V04-VER.EX01.xml', import.meta.url))
const browserErrors = new WeakMap()
const trainingFile = relative => fileURLToPath(new URL('../../TrainingTestCases-master/' + relative, import.meta.url))

test('C01 text baselines match the reference SVG, including rotated F.C.', async ({ page }) => {
  const sample = fileURLToPath(new URL('../dexpi_data/dexpi 1.3/example pids/C01 DEXPI Reference P&ID/C01V04-VER.EX01', import.meta.url))
  const svgSource = await readFile(`${sample}.svg`, 'utf8')
  await page.locator('input[type="file"]').setInputFiles(`${sample}.xml`)
  await expect(page.locator('.canvas-loading')).toHaveCount(0)
  const result = await page.evaluate(source => {
    const app = document.querySelector('.app-shell').__vue__
    const r = app.renderer
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
    svg.style.cssText = 'position:absolute; visibility:hidden; width:420px; height:297px'
    document.body.append(svg)
    // SVG x/y identify the alphabetic baseline. Let the browser apply the
    // reference transforms, then convert its downward Y to drawing coordinates.
    const references = [...svg.querySelectorAll('text')].map(element => {
      const matrix = element.getCTM()
      const point = new DOMPoint(+element.getAttribute('x'), +element.getAttribute('y')).matrixTransform(matrix)
      return { text: element.textContent, x: point.x, y: svg.viewBox.baseVal.height - point.y,
        angle: -Math.atan2(matrix.b, matrix.a) }
    })
    svg.remove()
    const readings = r.objects.filter(object => object.userData.isText).map(object => {
      const p = object.userData.primitive
      const cached = [...r.textCache.values()].find(entry => entry.material === object.material)
      // Undo the actual texture's ink-centre and horizontal-anchor offsets to
      // recover the mesh baseline, independently of the XML alignment offset.
      const edge = object.scale.x / 2 - cached.paddingRatio * p.height
      const localX = p.align === 'left' ? -edge : p.align === 'right' ? edge : 0
      const localY = -cached.inkCenterFromBaseline * p.height
      const cos = Math.cos(object.rotation.z), sin = Math.sin(object.rotation.z)
      const actual = { x: object.position.x + localX * cos - localY * sin,
        y: object.position.y + localX * sin + localY * cos, angle: object.rotation.z }
      const candidates = references.filter(reference => reference.text === p.text)
      candidates.sort((a, b) => Math.hypot(a.x - actual.x, a.y - actual.y) - Math.hypot(b.x - actual.x, b.y - actual.y))
      const expected = candidates[0]
      if (expected) references.splice(references.indexOf(expected), 1)
      return { text: p.text, actual, expected }
    })
    return { readings, remaining: references.length }
  }, svgSource)
  expect(result.readings).toHaveLength(245)
  expect(result.remaining).toBe(0)
  expect(result.readings.filter(reading => Math.abs(reading.expected.angle) > 1)).toHaveLength(13)
  for (const { text, actual, expected } of result.readings) {
    expect(expected, `${text} should have a reference SVG text`).toBeDefined()
    expect(actual.x, `${text} baseline X`).toBeCloseTo(expected.x, 5)
    expect(actual.y, `${text} baseline Y`).toBeCloseTo(expected.y, 5)
    expect(actual.angle, `${text} rotation`).toBeCloseTo(expected.angle, 8)
  }
})


test.beforeEach(async ({ page }) => {
  const errors = []
  browserErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await expect(page.locator('.document-title')).toContainText('C01V04-VER.EX01.xml')
  await expect(page.locator('.loaded-check')).toBeVisible()
  await expect(page.locator('.canvas-loading')).toHaveCount(0)
  await expect(page.locator('.canvas-empty')).toHaveCount(0)
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), 'browser should have no runtime or network console errors').toEqual([])
})

test('real sample, searchable engineering hierarchy, properties and original XML stay linked', async ({ page }) => {
  await expect(page.locator('.status-bar')).toContainText('5,216 个节点')
  await expect(page.locator('.status-bar')).toContainText('564 个图形')
  await expect(page.locator('.overview-metrics')).toContainText('29')
  const canvas = page.locator('canvas.diagram-webgl-canvas')
  await expect(canvas).toBeVisible()
  expect(await canvas.evaluate(element => element.width * element.height)).toBeGreaterThan(100000)

  await page.getByRole('textbox', { name: '搜索节点' }).fill('P4711')
  const pump = page.locator('.tree-row').filter({ has: page.locator('.tree-name', { hasText: /^P4711$/ }) })
  await expect(pump).toHaveCount(1)
  await pump.click()
  await expect(pump).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.selected-object h3')).toHaveText('P4711')
  await expect(page.locator('.inspector-scroll')).toContainText('CentrifugalPump-1')
  await expect(page.locator('.inspector-scroll')).toContainText('TagNameAssignmentClass')
  await expect(page.locator('.inspector-scroll')).toContainText('CENTRIFUGAL_PUMP_SHAPE')
  await page.locator('.inspector-tabs').getByRole('button', { name: 'XML', exact: true }).click()
  await expect(page.locator('.xml-code')).toContainText('<Equipment ID="CentrifugalPump-1"')
  await expect(page.locator('.xml-code')).toContainText('<Nozzle')

  await page.getByRole('button', { name: 'XML 节点树', exact: true }).click()
  await expect(page.locator('.tree-caption')).toContainText('5,216 节点')
  await page.getByRole('textbox', { name: '搜索节点' }).fill('SymbolRegistrationNumberAssignmentClass')
  await expect(page.locator('.tree-name', { hasText: /^Shapes$/ })).toBeVisible()
  await expect(page.locator('.tree-name', { hasText: /^SymbolRegistrationNumberAssignmentClass$/ }).first()).toBeVisible()
  await page.getByRole('textbox', { name: '搜索节点' }).fill('not-a-real-object-7149')
  await expect(page.locator('.empty-tree')).toContainText('没有找到匹配的节点')
})

test('canvas picking, zoom, focus, display layers and PNG/JSON exports work', async ({ page }, testInfo) => {
  const canvas = page.locator('canvas.diagram-webgl-canvas')
  const box = await canvas.boundingBox()
  // The official sample sheet has actual bounds [0,0]-[420,297]. Click the
  // centre stroke of P4711 at its real XML world coordinate (84,143).
  const scale = Math.min(Math.max(box.width - 96, box.width * 0.7) / 420, Math.max(box.height - 96, box.height * 0.7) / 297)
  await canvas.click({ position: { x: box.width / 2 + (84 - 210) * scale, y: box.height / 2 - (143 - 148.5) * scale } })
  await expect(page.locator('.selected-object h3')).toHaveText('P4711')
  await expect(page.locator('.tree-row[aria-selected="true"]')).toContainText('P4711')
  await page.getByRole('button', { name: '放大', exact: true }).click()
  await expect(page.locator('.zoom-value')).toHaveText('125%')
  await page.getByRole('button', { name: '缩小', exact: true }).click()
  await expect(page.locator('.zoom-value')).toHaveText('100%')
  await page.getByRole('button', { name: '在画布中定位' }).click()
  await expect(page.locator('.zoom-value')).not.toHaveText('100%')
  await page.getByRole('button', { name: '适应画布', exact: true }).click()
  await expect(page.locator('.zoom-value')).toHaveText('100%')

  await page.getByRole('button', { name: '切换网格', exact: true }).click()
  await expect(page.getByRole('button', { name: '切换网格', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '切换文字', exact: true }).click()
  await expect(page.getByRole('button', { name: '切换文字', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '图层管理', exact: true }).click()
  const equipmentLayer = page.getByRole('button', { name: '设备与喷嘴', exact: true })
  await equipmentLayer.click()
  await expect(equipmentLayer).toHaveClass(/disabled/)
  await equipmentLayer.click()
  await expect(equipmentLayer).not.toHaveClass(/disabled/)
  await page.getByRole('button', { name: '切换文字', exact: true }).click()

  await page.getByRole('button', { name: '导出', exact: true }).click()
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出解析数据 JSON' }).click(),
  ])
  expect(jsonDownload.suggestedFilename()).toBe('C01V04-VER.EX01.json')
  const jsonPath = testInfo.outputPath('parsed-model.json')
  await jsonDownload.saveAs(jsonPath)
  const exported = JSON.parse(await readFile(jsonPath, 'utf8'))
  expect(exported.nodes).toHaveLength(5216)
  expect(exported.primitives).toHaveLength(564)
  expect(exported.connections).toHaveLength(29)
  expect(exported.nodes.some(node => node.xmlId === 'CentrifugalPump-1' && node.properties.length === 8)).toBeTruthy()

  await page.getByRole('button', { name: '导出', exact: true }).click()
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出当前画布 PNG' }).click(),
  ])
  expect(pngDownload.suggestedFilename()).toBe('C01V04-VER.EX01.png')
  const pngPath = testInfo.outputPath('diagram.png')
  await pngDownload.saveAs(pngPath)
  const png = await readFile(pngPath)
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.length).toBeGreaterThan(10000)
})

test('sample switching and valid local import work; malformed import preserves the last good model', async ({ page }) => {
  await page.getByRole('button', { name: '切换示例', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '示例文件库' })).toBeVisible()
  await page.locator('.sample-card').filter({ hasText: 'C03V01-AVV.EX01.xml' }).click()
  await expect(page.locator('.document-title')).toContainText('C03V01-AVV.EX01.xml')
  await expect(page.locator('.status-bar')).toContainText('4,413 个节点')
  await expect(page.locator('.status-bar')).toContainText('324 个图形')
  await expect(page.locator('.canvas-empty')).toHaveCount(0)

  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '导入 XML', exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(referenceFile)
  await expect(page.locator('.document-title')).toContainText('C01V04-VER.EX01.xml')
  await expect(page.locator('.status-bar')).toContainText('5,216 个节点')
  await expect(page.locator('.canvas-document-label')).toContainText('本地工程文件')

  await page.locator('input[type="file"]').setInputFiles({ name: 'malformed.xml', mimeType: 'application/xml', buffer: Buffer.from('<PlantModel><Equipment></PlantModel>') })
  await expect(page.locator('.toast.error')).toContainText('XML 语法错误')
  await expect(page.locator('.document-title')).toContainText('C01V04-VER.EX01.xml')
  await expect(page.locator('.status-bar')).toContainText('5,216 个节点')
  await expect(page.locator('.canvas-empty')).toHaveCount(0)
  await page.getByRole('textbox', { name: '搜索节点' }).fill('P4711')
  await expect(page.locator('.tree-name', { hasText: /^P4711$/ })).toHaveCount(1)
})

test('C02 metre drawing preserves label size and fits the actual sheet', async ({ page }) => {
  const file = trainingFile('dexpi 1.3/example pids/C02 Process Column (BASF)/C02V03-VER.EX02.xml')
  test.skip(!existsSync(file), 'TrainingTestCases-master is not installed')
  await page.locator('input[type="file"]').setInputFiles(file)
  await expect(page.locator('.document-title')).toContainText('C02V03-VER.EX02.xml')
  await expect(page.locator('.status-bar')).toContainText('167 个图形')
  await expect(page.locator('.canvas-empty')).toHaveCount(0)
  const state = await page.evaluate(() => {
    const { model, renderer } = document.querySelector('.app-shell').__vue__
    return { heights: model.primitives.filter(p => p.type === 'text').map(p => p.height), bounds: renderer.allBounds, scale: renderer.fitScale, width: renderer.width, height: renderer.height }
  })
  expect(state.heights).toHaveLength(63)
  expect(Math.min(...state.heights)).toBeCloseTo(0.002, 8)
  expect(Math.max(...state.heights)).toBeLessThan(0.005)
  expect(state.bounds.maxX - state.bounds.minX).toBeCloseTo(0.42, 6)
  expect(state.bounds.maxY - state.bounds.minY).toBeCloseTo(0.297, 6)
  expect(state.scale).toBeCloseTo(Math.min((state.width - 96) / 0.42, (state.height - 96) / 0.297), 4)
  const stroke = await page.evaluate(() => {
    const renderer = document.querySelector('.app-shell').__vue__.renderer
    const object = renderer.objects.find(object => object.isLine2)
    return { pixels: object.material.linewidth, source: object.userData.primitive.lineWeight }
  })
  expect(stroke.pixels).toBeCloseTo(stroke.source * state.scale, 6)
  await page.getByRole('button', { name: '放大', exact: true }).click()
  const zoomedStroke = await page.evaluate(() => document.querySelector('.app-shell').__vue__.renderer.objects.find(object => object.isLine2).material.linewidth)
  expect(zoomedStroke).toBeCloseTo(stroke.pixels * 1.25, 6)
})

test('E01 semantic-only XML exposes tank data and explains why the canvas is empty', async ({ page }) => {
  const file = trainingFile('dexpi 1.3/example pids/E01 Tank/E01V02-VER.EX01.xml')
  test.skip(!existsSync(file), 'TrainingTestCases-master is not installed')
  await page.locator('input[type="file"]').setInputFiles(file)
  await expect(page.locator('.document-title')).toContainText('E01V02-VER.EX01.xml')
  await expect(page.locator('.status-bar')).toContainText('27 个节点')
  await expect(page.locator('.canvas-empty')).toContainText('工程数据已解析')
  await page.getByRole('textbox', { name: '搜索节点' }).fill('T4750')
  await page.locator('.tree-row').filter({ has: page.locator('.tree-name', { hasText: /^T4750$/ }) }).click()
  await expect(page.locator('.selected-object h3')).toHaveText('T4750')
  await expect(page.locator('.inspector-scroll')).toContainText('CylinderLength')
  await expect(page.locator('.toast.error')).toHaveCount(0)
})
