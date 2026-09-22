import test from 'node:test'
import assert from 'node:assert/strict'
import { IDENTITY, inverse, multiply, transform } from '../src/graphics/transform.js'
import { computeDocumentBounds } from '../src/graphics/bounds.js'
import { curveSpan, tessellateEllipse } from '../src/graphics/tessellator.js'

test('affine geometry supports mirrored, nonuniform transforms independently of XML', () => {
  const matrix = [-2, 0, 0, 3, 10, 20]
  const point = {
    x: 4,
    y: 6,
  }
  assert.deepEqual(transform(point, matrix), {
    x: 2,
    y: 38,
  })
  const restored = transform(transform(point, matrix), inverse(matrix))
  assert.ok(Math.abs(restored.x - point.x) < 1e-10)
  assert.ok(Math.abs(restored.y - point.y) < 1e-10)
  assert.deepEqual(multiply(matrix, IDENTITY), matrix)
  const points = tessellateEllipse(2, 1, 0, Math.PI, matrix)
  assert.deepEqual(points[0], {
    x: 6,
    y: 20,
  })
  assert.ok(Math.abs(points.at(-1).x - 14) < 1e-10)
  assert.equal(curveSpan(0, Math.PI, true), -Math.PI)
})

test('bounds include declared extents and expand a degenerate axis in drawing units', () => {
  const primitives = [
    {
      position: {
        x: 0.02,
        y: 0.03,
      },
    },
  ]
  const bounds = computeDocumentBounds(primitives, [], 0.001)
  assert.equal(bounds.minX, 0.02)
  assert.equal(bounds.maxX, 0.021)
  assert.equal(bounds.minY, 0.03)
  assert.equal(bounds.maxY, 0.031)
  const sheet = computeDocumentBounds(primitives, [
    {
      x: 0,
      y: 0,
    },
    {
      x: 1,
      y: 2,
    },
  ])
  assert.deepEqual(sheet, {
    minX: 0,
    minY: 0,
    maxX: 1,
    maxY: 2,
  })
})
