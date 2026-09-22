import {
  transform,
} from './transform.js'

const FULL_TURN = Math.PI * 2

/** Proteus trim angles are geometric polar angles, not ellipse parameters. */
export function ellipseParameter(polarAngle, radiusX, radiusY) {
  return Math.atan2(radiusX * Math.sin(polarAngle), radiusY * Math.cos(polarAngle))
}

export function curveSpan(start, end, clockwise) {
  let span = end - start
  while (span <= 0) {
    span += FULL_TURN
  }
  span = Math.min(span, FULL_TURN)
  if (clockwise) {
    return -(FULL_TURN - span || FULL_TURN)
  }
  return span
}

/** Transform every sample so mirrored and nonuniformly scaled arcs stay intact. */
export function tessellateEllipse(radiusX, radiusY, start, span, matrix) {
  const segments = Math.max(
    16,
    Math.min(160, Math.ceil(Math.abs(span) / (Math.PI / 48)))
  )
  return Array.from(
    {
      length: segments + 1,
    },
    (_, index) => {
      const angle = start + (span * index) / segments
      return transform(
        {
          x: radiusX * Math.cos(angle),
          y: radiusY * Math.sin(angle),
        },
        matrix
      )
    }
  )
}
