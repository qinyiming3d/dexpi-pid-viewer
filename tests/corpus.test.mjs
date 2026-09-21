import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { parseDexpi } from '../src/lib/dexpi-parser.js'
import { auditCorpus, defaultCorpus, decodeXml } from '../scripts/audit-corpus.mjs'

const corpus = process.env.DEXPI_CORPUS || defaultCorpus
const skip = !existsSync(corpus) && 'TrainingTestCases-master is not installed; set DEXPI_CORPUS to run corpus checks'
const close = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance
const samePoint = (a, b) => close(a.x, b.x) && close(a.y, b.y)
const identity = [1, 0, 0, 1, 0, 0]
const multiply = (a, b) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]]
const transform = (point, m) => ({ x: m[0]*point.x+m[2]*point.y+m[4], y: m[1]*point.x+m[3]*point.y+m[5] })
const numbers = string => (string.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/ig) || []).map(Number)

// Parse only the transform forms used by the independently supplied C02 SVG.
function svgMatrix(element) {
  let local = identity
  for (const [, name, value] of (element.getAttribute('transform') || '').matchAll(/(\w+)\(([^)]+)\)/g)) {
    const [a, b] = numbers(value)
    let matrix
    if (name === 'translate') matrix = [1, 0, 0, 1, a, b || 0]
    else if (name === 'scale') matrix = [a, 0, 0, b ?? a, 0, 0]
    else if (name === 'rotate') {
      const angle = a*Math.PI/180
      matrix = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]
    } else assert.fail(`Unexpected reference SVG transform: ${name}`)
    local = multiply(local, matrix)
  }
  return element.parentElement ? multiply(svgMatrix(element.parentElement), local) : local
}

function svgShape(element) {
  const matrix = svgMatrix(element)
  const values = numbers(element.getAttribute('points') || element.getAttribute('d'))
  const isArc = /A/.test(element.getAttribute('d') || '')
  const points = isArc
    ? [{ x: values[0], y: values[1] }, { x: values.at(-2), y: values.at(-1) }]
    : Array.from({ length: values.length/2 }, (_, i) => ({ x: values[i*2], y: values[i*2+1] }))
  let pointAt
  if (isArc) {
    const [x1, y1, rx, ry, rotation, large, sweep, x2, y2] = values
    assert.equal(rotation, 0, 'C02 reference arcs have unrotated circle axes')
    assert.ok(close(rx, ry), 'C02 reference arcs are circular')
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
    const chordSquared = dx * dx + dy * dy
    const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx - chordSquared) / chordSquared))
    const cx = (x1 + x2) / 2 + factor * dy
    const cy = (y1 + y2) / 2 - factor * dx
    const start = Math.atan2(y1 - cy, x1 - cx)
    let span = Math.atan2(y2 - cy, x2 - cx) - start
    if (sweep && span < 0) span += Math.PI * 2
    if (!sweep && span > 0) span -= Math.PI * 2
    pointAt = t => transform({ x: cx + rx * Math.cos(start + span * t), y: cy + ry * Math.sin(start + span * t) }, matrix)
  }
  return { points: points.map(point => transform(point, matrix)), pointAt, isArc, element }
}

test('all training XML parse safely and preserve explicit text heights across drawing units', { skip }, () => {
  const report = auditCorpus(corpus)
  assert.ok(report.summary.total >= 220, 'expected the complete training corpus, including uppercase .XML files')
  assert.equal(report.summary.failed, 0, JSON.stringify(report.results.filter(entry => entry.status === 'error')))
  assert.equal(report.summary.invalidGeometry, 0)
  assert.equal(report.summary.unexpectedZeroGeometry, 0, 'a source containing coordinates must not silently lose every primitive')
  assert.equal(report.summary.filesWithChangedDirectTextHeights, 0, 'explicit text heights must not be clamped to a fixed drawing-unit size')
  assert.ok(report.summary.filesWithSmallText >= 57)
  const empty = report.results.filter(entry => !entry.primitives)
  assert.ok(empty.length >= 42)
  assert.ok(empty.every(entry => entry.sourceDrawingCoordinates === 0 && entry.warnings.some(warning => /未发现可绘制|未包含|不包含|没有/.test(warning))))
})

test('C02 BASF matches the companion SVG text, fonts, transformed vertices and arc endpoints', { skip }, () => {
  const { window } = new JSDOM()
  globalThis.DOMParser = window.DOMParser
  globalThis.XMLSerializer = window.XMLSerializer
  const base = resolve(corpus, 'dexpi 1.3/example pids/C02 Process Column (BASF)/C02V03-VER.EX02')
  const model = parseDexpi(decodeXml(readFileSync(base + '.xml')))
  const svg = new DOMParser().parseFromString(readFileSync(base + '.svg', 'utf8'), 'application/xml')
  const svgElements = tag => [...svg.getElementsByTagNameNS('*', tag)]
  assert.equal(svgElements('text').length, 63)
  assert.equal(svgElements('path').length, 94)
  assert.equal(svgElements('polygon').length, 10)
  assert.equal(model.primitives.length, 167)
  const referenceText = svgElements('text').map(element => ({ text: element.textContent, height: parseFloat(element.getAttribute('font-size')), font: element.getAttribute('font-family') }))
  for (const primitive of model.primitives.filter(primitive => primitive.type === 'text')) {
    const index = referenceText.findIndex(reference => reference.text === primitive.text && close(reference.height, primitive.height * 5000) && reference.font === primitive.font)
    assert.ok(index >= 0, `text missing from reference SVG, or incorrect font/height: ${primitive.text} (${primitive.height})`)
    referenceText.splice(index, 1)
  }
  assert.equal(referenceText.length, 0)
  const referenceShapes = [...svgElements('path'), ...svgElements('polygon')].map(svgShape)
  for (const primitive of model.primitives.filter(primitive => primitive.type !== 'text')) {
    const points = primitive.points.map(point => ({ x: point.x * 5000, y: 1485 - point.y * 5000 }))
    const index = referenceShapes.findIndex(reference => {
      if (reference.isArc !== Boolean(primitive.curveType)) return false
      if (reference.isArc) {
        // SVG and XML may traverse the same arc in opposite directions.
        // Check every sampled point, not just endpoints (opposite semicircles
        // share endpoints but must never match).
        return [false, true].some(reverse => points.every((point, i) => samePoint(point, reference.pointAt(reverse ? 1 - i / (points.length - 1) : i / (points.length - 1)))))
      }
      return reference.points.length === points.length && points.every((point, i) => samePoint(point, reference.points[i]))
    })
    assert.ok(index >= 0, `shape differs from SVG after catalogue transform: ${primitive.sourceNodeId} ${JSON.stringify(points)}`)
    referenceShapes.splice(index, 1)
  }
  assert.equal(referenceShapes.length, 0, 'every SVG path and polygon must have exactly one corresponding parsed primitive')
  window.close()
})

test('ING and AUD dependency-only labels resolve real source properties', { skip }, () => {
  const { window } = new JSDOM()
  globalThis.DOMParser = window.DOMParser
  const tank = parseDexpi(decodeXml(readFileSync(resolve(corpus, 'dexpi 1.2/example pids/E01 Tank/E01V01-ING.EX01.xml'))))
  assert.ok(tank.primitives.some(primitive => primitive.type === 'text' && primitive.text === 'T4750'))
  const instrumentation = parseDexpi(decodeXml(readFileSync(resolve(corpus, 'dexpi 1.2/example pids/I01 Measurement/I01V01_AUD.EX01.xml'))))
  assert.ok(instrumentation.primitives.some(primitive => primitive.type === 'text' && primitive.text === 'LI'))
  assert.ok(instrumentation.primitives.some(primitive => primitive.type === 'text' && primitive.text === '123'))
  window.close()
})

test('E01 1.3 contains valid equipment data but no source drawing geometry', { skip }, () => {
  const { window } = new JSDOM()
  globalThis.DOMParser = window.DOMParser
  const tank = parseDexpi(decodeXml(readFileSync(resolve(corpus, 'dexpi 1.3/example pids/E01 Tank/E01V02-VER.EX01.xml'))))
  assert.equal(tank.nodes.length, 27)
  assert.equal(tank.stats.equipment, 3)
  assert.equal(tank.primitives.length, 0)
  assert.ok(tank.nodes.some(node => node.xmlId === 'Tank-1' && node.label === 'T4750'))
  for (const id of ['Chamber-1', 'Chamber-2']) assert.equal(tank.nodes.find(node => node.xmlId === id).properties.length, 7)
  assert.ok(tank.warnings.some(warning => warning.includes('未发现可绘制')))
  window.close()
})
