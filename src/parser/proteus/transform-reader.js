import {
  direct,
  numberAttr,
  pointOf,
  positionOf,
} from '../xml/xml-utils.js'

/** Read a Proteus local transform; all returned values remain in drawing units. */
export function matrixOf(element) {
  const position = direct(element, 'Position')
  const location = positionOf(element) || {
    x: 0,
    y: 0,
  }
  const reference = pointOf(position && direct(position, 'Reference')) || {
    x: 1,
    y: 0,
  }
  const angle = Math.atan2(reference.y, reference.x)
  const scale = direct(element, 'Scale')
  // Negative Axis.Z mirrors local X before rotation in the reference exports.
  const mirrorX = numberAttr(position && direct(position, 'Axis'), 'Z', 1) < 0 ? -1 : 1
  const scaleX = numberAttr(scale, 'X', 1) * mirrorX
  const scaleY = numberAttr(scale, 'Y', 1)
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return [
    cosine * scaleX,
    sine * scaleX,
    -sine * scaleY,
    cosine * scaleY,
    location.x,
    location.y,
  ]
}
