import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { DiagramRenderer } from '../src/lib/diagram-renderer.js'

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-7, `${actual} != ${expected}`)
const rendererWithoutCanvas = () => Object.assign(Object.create(DiagramRenderer.prototype), {
  width: 1200,
  height: 800,
  materials: new Map(),
  textCache: new Map(),
  unitPlane: new THREE.PlaneGeometry(1, 1),
})

test('fitting and focusing a drawing are invariant under metre/millimetre units', () => {
  const renderer = rendererWithoutCanvas()
  const sheetInMm = { minX: 0, minY: 0, maxX: 420, maxY: 297 }
  const sheetInM = { minX: 0, minY: 0, maxX: 0.420, maxY: 0.297 }
  near(renderer.scaleForBounds(sheetInM), renderer.scaleForBounds(sheetInMm) * 1000)
  const symbolInM = { minX: 0.1, minY: 0.1, maxX: 0.102, maxY: 0.106 }
  const symbolInMm = { minX: 100, minY: 100, maxX: 102, maxY: 106 }
  near(renderer.scaleForBounds(symbolInM), renderer.scaleForBounds(symbolInMm) * 1000)
  for (const bounds of [
    { minX: 0, minY: 0, maxX: 0.1, maxY: 0 },
    { minX: 0, minY: 0, maxX: 0, maxY: 0.1 },
    { minX: 3, minY: 4, maxX: 3, maxY: 4 },
  ]) assert.ok(Number.isFinite(renderer.scaleForBounds(bounds)))
})

test('source Presentation colours and both Proteus dashed line encodings reach rendered materials', () => {
  const renderer = rendererWithoutCanvas()
  assert.equal(renderer.colorOf({ color: '#000000' }, 'equipment'), '#000000')
  assert.equal(renderer.colorOf({ color: '#808000' }, 'piping'), '#808000')
  assert.equal(renderer.colorOf({ color: '#0000ff' }, 'instrumentation'), '#0000ff')
  const signal = renderer.createShape({ type: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], lineType: '2', lineWeight: 0.2 }, 'instrumentation')
  assert.equal(signal.material.isLineMaterial, true)
  assert.equal(signal.material.dashed, true)
  assert.equal(signal.material.worldUnits, false)
  near(signal.material.linewidth, 0.2)
  // The C01 reference SVG specifies stroke-dasharray="1 1.4".
  near(signal.material.dashSize, 1)
  near(signal.material.gapSize, 1.4)
  assert.equal(signal.geometry.getAttribute('instanceDistanceEnd').getX(0), 10)
  const inMetres = renderer.lineMaterial({ lineType: 'Dashed', lineWeight: 0.00035 }, 'equipment')
  const inMillimetres = renderer.lineMaterial({ lineType: 'Dashed', lineWeight: 0.35 }, 'equipment')
  assert.equal(inMetres.dashed, true)
  near(inMetres.linewidth * 1000, inMillimetres.linewidth)
  near(inMetres.dashSize * 1000, inMillimetres.dashSize)
  near(inMetres.gapSize * 1000, inMillimetres.gapSize)
  assert.notEqual(inMetres, inMillimetres)
  assert.equal(renderer.lineMaterial({ lineType: 'Solid' }, 'equipment').dashed, false)
})

test('dashed closed shapes include the closing edge in line distances', () => {
  const renderer = rendererWithoutCanvas()
  const shape = renderer.createShape({ type: 'polyline', closed: true, lineType: 'Dashed', lineWeight: 0.25, points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }] }, 'equipment')
  const distances = shape.geometry.getAttribute('instanceDistanceEnd')
  assert.equal(distances.count, 3)
  near(distances.getX(2), 12)
})

test('text honours source fonts and em-box baselines, and preserves small heights', () => {
  const previousDocument = globalThis.document
  const contexts = []
  globalThis.document = {
    createElement() {
      const context = {
        font: '',
        measureText() { return { width: this.font.includes('Calibri') ? 120 : 144, actualBoundingBoxAscent: 36, actualBoundingBoxDescent: 8 } },
        scale() {},
        fillText() {},
      }
      contexts.push(context)
      return { width: 0, height: 0, getContext: () => context }
    },
  }
  try {
    const renderer = rendererWithoutCanvas()
    const primitive = { type: 'text', text: 'P-101', position: { x: 0.1, y: 0.2 }, height: 0.002, font: 'Calibri', align: 'left', verticalAlign: 'bottom' }
    const text = renderer.createText(primitive, 'equipment')
    assert.equal(text.material.map.minFilter, THREE.LinearMipmapLinearFilter)
    assert.equal(text.material.map.generateMipmaps, true)
    assert.match(contexts[0].font, /"Calibri"/)
    assert.ok(text.scale.y < 0.003)
    const padding = primitive.height * 4 / 48
    near(text.position.x - text.scale.x / 2 + padding, primitive.position.x)
    near(text.position.y - (36 - 8) / (2 * 48) * primitive.height, primitive.position.y)
    const otherFont = renderer.createText({ ...primitive, font: 'Arial' }, 'equipment')
    assert.notEqual(text.material, otherFont.material)
    assert.ok(otherFont.scale.x > text.scale.x)
    const rotated = renderer.createText({ ...primitive, rotation: Math.PI / 2, align: 'center', verticalAlign: 'middle' }, 'equipment')
    const inkOffset = (36 - 8) / (2 * 48) * primitive.height
    near(rotated.position.x, primitive.position.x - inkOffset)
    near(rotated.position.y, primitive.position.y - primitive.height / 2)
    near(rotated.rotation.z, Math.PI / 2)
    const inMm = renderer.createText({ ...primitive, height: 2, position: { x: 100, y: 200 } }, 'equipment')
    near(inMm.scale.x, text.scale.x * 1000)
    near(inMm.scale.y, text.scale.y * 1000)
  } finally {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})
