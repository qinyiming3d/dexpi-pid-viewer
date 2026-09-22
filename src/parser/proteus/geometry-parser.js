import {
  attr,
  childrenOf,
  direct,
  numberAttr,
  pointOf,
  positionOf,
  tagOf,
} from '../xml/xml-utils.js'
import {
  multiply,
  transform,
} from '../../graphics/transform.js'
import {
  curveSpan,
  ellipseParameter,
  tessellateEllipse,
} from '../../graphics/tessellator.js'
import {
  matrixOf,
} from './transform-reader.js'
import {
  styleOf,
} from './style-reader.js'

const LINE_TAGS = new Set(['PolyLine', 'Polyline', 'Line', 'CenterLine', 'Shape', 'Polygon'])
const CURVE_TAGS = new Set(['Circle', 'Ellipse', 'TrimmedCurve'])

function readLineEndpoints(element) {
  const points = ['StartPoint', 'EndPoint', 'Start', 'End']
    .map((name) => pointOf(direct(element, name)))
    .filter(Boolean)
  if (points.length) {
    return points
  }
  const x1 = numberAttr(element, ['X1', 'x1'])
  const y1 = numberAttr(element, ['Y1', 'y1'])
  const x2 = numberAttr(element, ['X2', 'x2'])
  const y2 = numberAttr(element, ['Y2', 'y2'])
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    return []
  }
  return [
    {
      x: x1,
      y: y1,
    },
    {
      x: x2,
      y: y2,
    },
  ]
}

function parseLine(element, matrix, warn) {
  const tag = tagOf(element)
  let points = childrenOf(element)
    .filter((child) => ['Coordinate', 'Point'].includes(tagOf(child)))
    .map(pointOf)
    .filter(Boolean)
  if (!points.length && tag === 'Line') {
    points = readLineEndpoints(element)
  }
  if (points.length < 2) {
    warn(`${tag} 缺少有效坐标，已跳过。`)
    return null
  }
  const isShape = tag === 'Shape' || tag === 'Polygon'
  const fill = attr(element, 'Filled', 'Fill')
  const filled = isShape && /solid|true|1/i.test(fill)
  if (isShape && /hatch/i.test(fill)) {
    warn('部分 Shape 使用 Hatch 填充：当前仅显示其轮廓。')
  }
  return {
    type: filled ? 'polygon' : 'polyline',
    points: points.map((point) => transform(point, matrix)),
    closed: isShape || /true|1/i.test(attr(element, 'Closed')),
    filled,
  }
}

function readCurveAngles(element, curveTag, radiusX, radiusY) {
  const trimmed = tagOf(element) === 'TrimmedCurve'
  let start = trimmed ? numberAttr(element, 'StartAngle', 0) * Math.PI / 180 : 0
  let end = trimmed ? numberAttr(element, 'EndAngle', 360) * Math.PI / 180 : Math.PI * 2
  if (trimmed && curveTag === 'Ellipse') {
    start = ellipseParameter(start, radiusX, radiusY)
    end = ellipseParameter(end, radiusX, radiusY)
  }
  return {
    start,
    span: curveSpan(start, end, /false|0/i.test(attr(element, 'SenseAgreement'))),
  }
}

function parseCurve(element, matrix, warn, defaultLineWeight) {
  const trimmed = tagOf(element) === 'TrimmedCurve'
  const curve = trimmed
    ? childrenOf(element).find((child) => ['Circle', 'Ellipse'].includes(tagOf(child)))
    : element
  if (!curve) {
    warn('TrimmedCurve 的曲线类型尚未支持。')
    return null
  }
  const curveTag = tagOf(curve)
  const radiusX = curveTag === 'Circle'
    ? numberAttr(curve, 'Radius')
    : numberAttr(curve, ['PrimaryAxis', 'MajorRadius', 'RadiusX'])
  const radiusY = curveTag === 'Circle'
    ? radiusX
    : numberAttr(curve, ['SecondaryAxis', 'MinorRadius', 'RadiusY'])
  if (!positionOf(curve) || !(radiusX > 0) || !(radiusY > 0)) {
    warn(`${curveTag} 缺少有效位置或半径，已跳过。`)
    return null
  }
  const angles = readCurveAngles(element, curveTag, radiusX, radiusY)
  const curveMatrix = multiply(matrix, matrixOf(curve))
  const fill = attr(curve, 'Filled', 'Fill')
  const filled = !trimmed && /solid|true|1/i.test(fill)
  if (/hatch/i.test(fill)) {
    warn(`部分 ${curveTag} 使用 Hatch 填充：当前仅显示其轮廓。`)
  }
  return {
    ...styleOf(curve, defaultLineWeight),
    type: filled ? 'polygon' : 'polyline',
    points: tessellateEllipse(radiusX, radiusY, angles.start, angles.span, curveMatrix),
    closed: !trimmed,
    curveType: curveTag,
    filled,
  }
}

function textAlignment(element) {
  const justification = attr(element, 'Justification')
  let align = 'left'
  if (/^Center/i.test(justification)) {
    align = 'center'
  } else if (/^Right/i.test(justification)) {
    align = 'right'
  }
  let verticalAlign = 'bottom'
  if (/Top$/i.test(justification)) {
    verticalAlign = 'top'
  } else if (/Center$/i.test(justification)) {
    verticalAlign = 'middle'
  }
  return {
    align,
    verticalAlign,
  }
}

function textRotation(element, matrix) {
  const local = matrixOf(element)
  const angle = numberAttr(element, 'TextAngle', 0) * Math.PI / 180
    + Math.atan2(local[1], local[0])
  const dx = matrix[0] * Math.cos(angle) + matrix[2] * Math.sin(angle)
  const dy = matrix[1] * Math.cos(angle) + matrix[3] * Math.sin(angle)
  return Math.atan2(dy, dx)
}

function parseText(element, text, matrix, warn, millimetre) {
  if (!text) {
    return null
  }
  const extent = direct(element, 'Extent')
  const position = positionOf(element) || pointOf(extent && direct(extent, 'Min'))
  if (!position) {
    warn('Text 缺少 Position / Extent，已跳过文字图元。')
    return null
  }
  if (numberAttr(element, 'SlantAngle', 0) !== 0) {
    warn('部分文字使用 SlantAngle：当前未应用文字倾斜。')
  }
  // Height stays in drawing units; only the omitted default depends on units.
  const height = numberAttr(element, 'Height', 2.5 * millimetre)
  const transformedHeight = height * Math.hypot(matrix[2], matrix[3])
  if (!(transformedHeight > 0)) {
    warn('Text 的 Height 或缩放无效，已跳过文字图元。')
    return null
  }
  return {
    type: 'text',
    text,
    position: transform(position, matrix),
    height: transformedHeight,
    rotation: textRotation(element, matrix),
    ...textAlignment(element),
    font: attr(element, 'Font'),
  }
}

/** Read one drawable. Identity, ownership and catalogue order are assigned by the caller. */
export function createGeometryParser({
  textOf,
  warn,
  millimetre,
  defaultLineWeight,
}) {
  return function parseGeometry(element, nodeId, matrix) {
    const tag = tagOf(element)
    let geometry = null
    if (LINE_TAGS.has(tag)) {
      geometry = parseLine(element, matrix, warn)
    } else if (CURVE_TAGS.has(tag)) {
      geometry = parseCurve(element, matrix, warn, defaultLineWeight)
    } else if (tag === 'Text') {
      geometry = parseText(element, textOf(element, nodeId), matrix, warn, millimetre)
    }
    if (!geometry) {
      return null
    }
    return {
      ...styleOf(element, defaultLineWeight),
      ...geometry,
    }
  }
}
