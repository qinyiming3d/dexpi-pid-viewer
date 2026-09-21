/**
 * Browser-only DEXPI / Proteus XML reader. Geometry uses drawing units, Y-up,
 * with all catalogue transforms already applied. Rotations are radians.
 * This is a tolerant viewer, not a full XSD or DEXPI conformance validator.
 */
const IDENTITY = [1, 0, 0, 1, 0, 0]
const GEOMETRY = new Set(['PolyLine', 'Polyline', 'Line', 'CenterLine', 'Shape', 'Polygon', 'Circle', 'Ellipse', 'TrimmedCurve', 'Text'])
const EQUIPMENT = new Set(['Equipment', 'Nozzle', 'EquipmentComponent'])
const PIPING = new Set(['PipingNetworkSystem', 'PipingNetworkSegment', 'PipingComponent', 'PipeOffPageConnector', 'PipeConnectorSymbol', 'PipeFlowArrow', 'PipeSlopeSymbol', 'InsulationSymbol', 'PropertyBreak', 'ConnectionPoints', 'Node'])
const INSTRUMENTATION = /^(Instrumentation|Instrument|ProcessInstrumentation|ProcessSignal|Actuating|Signal|InformationFlow)/
const META = new Set(['MetaData', 'PlantInformation', 'UnitsOfMeasure', 'GenericAttributes', 'GenericAttribute', 'Association', 'Connection', 'PersistentID', 'NominalDiameter'])
const IGNORE_DRAWING = new Set(['Position', 'Scale', 'Location', 'Axis', 'Reference', 'Extent', 'Min', 'Max', 'Presentation', 'Coordinate', 'ConnectionPoints', 'Node', 'GenericAttributes', 'GenericAttribute', 'Association', 'Connection', 'PersistentID', 'NominalDiameter', 'TextStringFormatSpecification'])
const tagOf = element => element.localName || element.nodeName.split(':').pop()
const childrenOf = element => Array.from(element.children || [])
const direct = (element, tag) => childrenOf(element).find(child => tagOf(child) === tag)
function attr(element, ...names) {
  if (!element) return ''
  for (const name of names) {
    if (element.hasAttribute(name)) return element.getAttribute(name)
    const found = Array.from(element.attributes).find(a => a.localName === name)
    if (found) return found.value
  }
  return ''
}
function numberAttr(element, names, fallback = NaN) {
  const value = attr(element, ...[].concat(names))
  if (value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}
function pointOf(element) {
  if (!element) return null
  const x = numberAttr(element, ['X', 'x'])
  const y = numberAttr(element, ['Y', 'y'])
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}
function positionOf(element) {
  const position = direct(element, 'Position')
  return pointOf(position && direct(position, 'Location')) || pointOf(direct(element, 'Location'))
}
function matrixOf(element) {
  const position = direct(element, 'Position')
  const location = positionOf(element) || { x: 0, y: 0 }
  const reference = pointOf(position && direct(position, 'Reference')) || { x: 1, y: 0 }
  const angle = Math.atan2(reference.y, reference.x)
  const scale = direct(element, 'Scale')
  // The DEXPI reference exports use a negative Axis.Z to mirror local X
  // before rotation (C01's safety valve and its companion SVG show this).
  // Compose it with Scale so explicit negative scales still work.
  const mirrorX = numberAttr(position && direct(position, 'Axis'), 'Z', 1) < 0 ? -1 : 1
  const sx = numberAttr(scale, 'X', 1) * mirrorX, sy = numberAttr(scale, 'Y', 1)
  const c = Math.cos(angle), s = Math.sin(angle)
  return [c * sx, s * sx, -s * sy, c * sy, location.x, location.y]
}
function multiply(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]
}
function inverse(m) {
  const determinant = m[0] * m[3] - m[1] * m[2]
  if (Math.abs(determinant) < 1e-12) return IDENTITY
  return [m[3] / determinant, -m[1] / determinant, -m[2] / determinant, m[0] / determinant, (m[2] * m[5] - m[3] * m[4]) / determinant, (m[1] * m[4] - m[0] * m[5]) / determinant]
}
function transform(point, matrix) {
  return { x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] }
}
function categoryOf(tag, element) {
  if (EQUIPMENT.has(tag)) return 'equipment'
  if (PIPING.has(tag)) return 'piping'
  if (INSTRUMENTATION.test(tag)) return 'instrumentation'
  if (META.has(tag)) return 'metadata'
  if (GEOMETRY.has(tag) || ['Drawing', 'DrawingBorder', 'Label', 'ShapeCatalogue', 'Representation', 'Group'].includes(tag)) return 'drawing'
  if (attr(element, 'ComponentClass')) {
    const type = attr(element, 'ComponentClass')
    if (/Pump|Tank|Vessel|Exchanger|Chamber|Equipment/.test(type)) return 'equipment'
    if (/Valve|Piping|Pipe/.test(type)) return 'piping'
    if (/Instrument|Signal|Actuat/.test(type)) return 'instrumentation'
  }
  return 'other'
}
function genericProperties(element) {
  const result = []
  for (const group of childrenOf(element).filter(child => tagOf(child) === 'GenericAttributes')) {
    for (const property of childrenOf(group).filter(child => tagOf(child) === 'GenericAttribute')) {
      result.push({
        name: attr(property, 'Name'), value: attr(property, 'Value') || property.textContent.trim(),
        unit: attr(property, 'Units', 'Unit', 'UnitsOfMeasure'), source: attr(group, 'Set') || 'GenericAttributes',
        format: attr(property, 'Format'), language: attr(property, 'Language'), uri: attr(property, 'AttributeURI'),
      })
    }
  }
  return result
}
function labelOf(element, properties) {
  const tag = tagOf(element)
  const preferred = properties.find(p => /^(TagName|EquipmentTagName|PipingComponentNumber|ProcessInstrumentationFunctionNumber|InstrumentationLoopFunctionNumber|ActuatingSystemNumber|SegmentNumber|LineNumber)(AssignmentClass)?$/.test(p.name) && p.value)
  return attr(element, 'TagName') || preferred?.value || attr(element, 'Name', 'name', 'ComponentClass', 'ComponentName', 'ID', 'id') || (tag === 'Text' ? attr(element, 'String').slice(0, 60) : '') || tag
}
function styleOf(element, defaultLineWeight = 0.25) {
  const p = direct(element, 'Presentation')
  const rgb = ['R', 'G', 'B'].map(channel => numberAttr(p, channel))
  const color = rgb.every(Number.isFinite)
    ? '#' + rgb.map(value => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join('')
    : attr(p, 'Color') || '#263945'
  return { color, lineWeight: numberAttr(p, 'LineWeight', defaultLineWeight), lineType: attr(p, 'LineType'), layer: attr(p, 'Layer') }
}

export function parseDexpi(xml, { fileName = '未命名.xml' } = {}) {
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('XML 文件为空。')
  // FileReader / fs strings can retain a BOM; TextDecoder normally removes it.
  xml = xml.replace(/^\uFEFF/, '')
  if (xml.length > 30 * 1024 * 1024) throw new Error('XML 超过 30 MB，请使用较小的图纸。')
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('不支持包含 DOCTYPE 或 ENTITY 声明的 XML。')
  if (typeof DOMParser === 'undefined') throw new Error('当前环境不支持 DOMParser。')
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = document.getElementsByTagName('parsererror')[0] || document.getElementsByTagNameNS('*', 'parsererror')[0]
  if (parseError) throw new Error('XML 语法错误：' + parseError.textContent.trim().slice(0, 240))
  const root = document.documentElement
  const rootTag = tagOf(root)
  const nativeDexpi = rootTag === 'Model' && (/dexpi/i.test(root.namespaceURI || '') || /dexpi/i.test(xml.slice(0, 8000)))
  if (rootTag !== 'PlantModel' && !nativeDexpi) throw new Error('不是受支持的 DEXPI XML：需要 PlantModel（Proteus）或 DEXPI Model 根节点。')
  const info = direct(root, 'PlantInformation')
  // Defaults only: never rescale source coordinates or explicitly supplied sizes.
  const unit = attr(info, 'Units').toLowerCase()
  const millimetre = ({ m: 0.001, metre: 0.001, meter: 0.001, cm: 0.1, centimetre: 0.1, centimeter: 0.1, in: 1 / 25.4, inch: 1 / 25.4, ft: 1 / 304.8, foot: 1 / 304.8 })[unit] || 1
  const defaultLineWeight = 0.25 * millimetre

  const nodes = [], primitives = [], connections = [], warnings = []
  const nodeMap = new Map(), elementToNode = new WeakMap(), idToElements = new Map(), nodeToElement = new Map()
  const warningSet = new Set()
  const warn = message => { if (!warningSet.has(message)) { warningSet.add(message); warnings.push(message) } }
  const stack = [{ element: root, parentId: null, catalogue: false, ownerId: null, depth: 0 }]
  while (stack.length) {
    const { element, parentId, catalogue, ownerId, depth } = stack.pop()
    if (depth > 256) throw new Error('XML 节点嵌套超过 256 层，无法安全解析。')
    if (nodes.length >= 100000) throw new Error('XML 超过 100,000 个节点，请按图纸拆分。')
    const tag = tagOf(element), isCatalogue = catalogue || tag === 'ShapeCatalogue'
    const id = 'n' + nodes.length, xmlId = attr(element, 'ID', 'id')
    const properties = genericProperties(element)
    const category = categoryOf(tag, element)
    const isSemantic = !GEOMETRY.has(tag) && !['ConnectionPoints', 'Node', 'Label', 'ShapeCatalogue'].includes(tag) && (['equipment', 'piping', 'instrumentation'].includes(category) || tag === 'Drawing' || tag === 'MetaData' || Boolean(attr(element, 'ComponentClass')))
    const semanticId = isSemantic ? id : ownerId || id
    const node = {
      id, xmlId, tag, label: labelOf(element, properties), category, parentId, childIds: [],
      attributes: Object.fromEntries(Array.from(element.attributes).map(a => [a.name, a.value])), properties,
      text: Array.from(element.childNodes).filter(n => n.nodeType === 3 || n.nodeType === 4).map(n => n.textContent).join('').trim(),
      isCatalogue, isSemantic, semanticId,
    }
    nodes.push(node); nodeMap.set(id, node); elementToNode.set(element, node); nodeToElement.set(id, element)
    if (parentId) nodeMap.get(parentId).childIds.push(id)
    if (xmlId) {
      if (!idToElements.has(xmlId)) idToElements.set(xmlId, [])
      idToElements.get(xmlId).push(element)
      if (idToElements.get(xmlId).length > 1) warn(`重复的 XML ID：${xmlId}；保留全部节点，并优先解析非符号库对象。`)
    }
    const children = childrenOf(element)
    for (let i = children.length - 1; i >= 0; i--) stack.push({ element: children[i], parentId: id, catalogue: isCatalogue, ownerId: isSemantic ? id : ownerId, depth: depth + 1 })
  }
  const resolve = reference => {
    const matches = idToElements.get((reference || '').replace(/^#/, '')) || []
    return matches.find(element => !elementToNode.get(element).isCatalogue) || matches[0] || null
  }
  const catalogue = new Map()
  for (const node of nodes) {
    if (!node.isCatalogue) continue
    const element = nodeToElement.get(node.id)
    if (attr(element, 'ComponentName')) catalogue.set(attr(element, 'ComponentName'), element)
    if (node.xmlId) catalogue.set(node.xmlId, element)
  }

  function referencedText(reference, owner, { literal = false } = {}) {
    const expression = attr(reference, 'DependantAttribute', 'DependentAttribute')
    const itemId = attr(reference, 'ItemID')
    if (literal && !itemId) return expression
    const target = itemId ? resolve(itemId) : owner
    if (!target) { warn(`未解析文字引用 ItemID：${itemId}。`); return '' }
    const contents = attr(reference, 'DependantAttributeContents', 'DependentAttributeContents') || 'Value'
    const lookup = name => {
      // Both element attributes (TagName) and GenericAttribute values occur in
      // real Proteus exports. Keep the lookup on the referenced object itself.
      if (contents === 'Value' && target.hasAttribute(name)) return attr(target, name)
      for (const group of childrenOf(target).filter(child => tagOf(child) === 'GenericAttributes')) {
        const property = childrenOf(group).find(child => tagOf(child) === 'GenericAttribute' && attr(child, 'Name') === name)
        if (property) return attr(property, contents) || (contents === 'Value' ? property.textContent.trim() : '')
      }
      warn(`未解析文字属性：${itemId || attr(target, 'ID') || tagOf(target)} / ${name}。`)
      return ''
    }
    if (/\[[^\]]+\]/.test(expression)) return expression.replace(/\[([^\]]+)\]/g, (_, name) => lookup(name))
    return expression ? lookup(expression) : ''
  }

  function textOf(element, nodeId) {
    const explicit = attr(element, 'String', 'Value')
    if (explicit) return explicit
    const owner = nodeToElement.get(nodeId)
    const specification = direct(element, 'TextStringFormatSpecification')
    if (specification) return childrenOf(specification)
      .filter(child => tagOf(child) === 'ObjectAttributesReference')
      .map(reference => referencedText(reference, owner, { literal: true })).join('')
    if (attr(element, 'DependantAttribute', 'DependentAttribute')) return referencedText(element, owner)
    // Only direct character data is literal text, not nested XML metadata.
    return Array.from(element.childNodes).filter(node => node.nodeType === 3 || node.nodeType === 4).map(node => node.textContent).join('').trim()
  }

  const append = primitive => {
    primitive.id = 'p' + primitives.length
    primitives.push(primitive)
  }
  function renderGeometry(element, nodeId, matrix) {
    const tag = tagOf(element)
    const common = { nodeId, sourceNodeId: elementToNode.get(element)?.id, ...styleOf(element, defaultLineWeight) }
    if (['PolyLine', 'Polyline', 'Line', 'CenterLine', 'Shape', 'Polygon'].includes(tag)) {
      let points = childrenOf(element).filter(child => ['Coordinate', 'Point'].includes(tagOf(child))).map(pointOf).filter(Boolean)
      if (!points.length && tag === 'Line') {
        points = ['StartPoint', 'EndPoint', 'Start', 'End'].map(name => pointOf(direct(element, name))).filter(Boolean)
        if (!points.length) {
          const x1 = numberAttr(element, ['X1', 'x1']), y1 = numberAttr(element, ['Y1', 'y1'])
          const x2 = numberAttr(element, ['X2', 'x2']), y2 = numberAttr(element, ['Y2', 'y2'])
          if ([x1, y1, x2, y2].every(Number.isFinite)) points = [{ x: x1, y: y1 }, { x: x2, y: y2 }]
        }
      }
      if (points.length < 2) { warn(`${tag} 缺少有效坐标，已跳过。`); return }
      const isShape = tag === 'Shape' || tag === 'Polygon'
      const filled = isShape && /solid|true|1/i.test(attr(element, 'Filled', 'Fill'))
      if (isShape && /hatch/i.test(attr(element, 'Filled', 'Fill'))) warn('部分 Shape 使用 Hatch 填充：当前仅显示其轮廓。')
      append({ ...common, type: filled ? 'polygon' : 'polyline', points: points.map(point => transform(point, matrix)), closed: isShape || /true|1/i.test(attr(element, 'Closed')), filled })
      return
    }
    if (tag === 'Circle' || tag === 'Ellipse' || tag === 'TrimmedCurve') {
      const curve = tag === 'TrimmedCurve' ? childrenOf(element).find(child => ['Circle', 'Ellipse'].includes(tagOf(child))) : element
      if (!curve) { warn('TrimmedCurve 的曲线类型尚未支持。'); return }
      const curveTag = tagOf(curve)
      const rx = curveTag === 'Circle' ? numberAttr(curve, 'Radius') : numberAttr(curve, ['PrimaryAxis', 'MajorRadius', 'RadiusX'])
      const ry = curveTag === 'Circle' ? rx : numberAttr(curve, ['SecondaryAxis', 'MinorRadius', 'RadiusY'])
      const center = positionOf(curve)
      if (!center || !(rx > 0) || !(ry > 0)) { warn(`${curveTag} 缺少有效位置或半径，已跳过。`); return }
      const m = multiply(matrix, matrixOf(curve))
      let start = tag === 'TrimmedCurve' ? numberAttr(element, 'StartAngle', 0) * Math.PI / 180 : 0
      let end = tag === 'TrimmedCurve' ? numberAttr(element, 'EndAngle', 360) * Math.PI / 180 : Math.PI * 2
      // Proteus stores geometric polar angles, not the ellipse parameter t.
      if (tag === 'TrimmedCurve' && curveTag === 'Ellipse') {
        start = Math.atan2(rx * Math.sin(start), ry * Math.cos(start))
        end = Math.atan2(rx * Math.sin(end), ry * Math.cos(end))
      }
      let span = end - start
      while (span <= 0) span += Math.PI * 2
      span = Math.min(span, Math.PI * 2)
      const clockwise = /false|0/i.test(attr(element, 'SenseAgreement'))
      if (clockwise) span = -(Math.PI * 2 - span || Math.PI * 2)
      // Curves are sampled after the full affine transform, preserving mirroring
      // and nonuniform scales without losing elliptical arcs.
      const segments = Math.max(16, Math.min(160, Math.ceil(Math.abs(span) / (Math.PI / 48))))
      const points = Array.from({ length: segments + 1 }, (_, i) => {
        const angle = start + span * i / segments
        return transform({ x: rx * Math.cos(angle), y: ry * Math.sin(angle) }, m)
      })
      const filled = tag !== 'TrimmedCurve' && /solid|true|1/i.test(attr(curve, 'Filled', 'Fill'))
      if (/hatch/i.test(attr(curve, 'Filled', 'Fill'))) warn(`部分 ${curveTag} 使用 Hatch 填充：当前仅显示其轮廓。`)
      append({ ...common, ...styleOf(curve, defaultLineWeight), type: filled ? 'polygon' : 'polyline', points, closed: tag !== 'TrimmedCurve', curveType: curveTag, filled })
      return
    }
    if (tag === 'Text') {
      const text = textOf(element, nodeId)
      if (!text) return
      let position = positionOf(element)
      if (!position) {
        const extent = direct(element, 'Extent')
        position = pointOf(extent && direct(extent, 'Min'))
      }
      if (!position) { warn('Text 缺少 Position / Extent，已跳过文字图元。'); return }
      const height = numberAttr(element, 'Height', 2.5 * millimetre)
      const local = matrixOf(element)
      const angle = numberAttr(element, 'TextAngle', 0) * Math.PI / 180 + Math.atan2(local[1], local[0])
      const dx = matrix[0] * Math.cos(angle) + matrix[2] * Math.sin(angle)
      const dy = matrix[1] * Math.cos(angle) + matrix[3] * Math.sin(angle)
      const justification = attr(element, 'Justification')
      const align = /^Center/i.test(justification) ? 'center' : /^Right/i.test(justification) ? 'right' : 'left'
      const verticalAlign = /Top$/i.test(justification) ? 'top' : /Center$/i.test(justification) ? 'middle' : 'bottom'
      if (numberAttr(element, 'SlantAngle', 0) !== 0) warn('部分文字使用 SlantAngle：当前未应用文字倾斜。')
      // Height is expressed in drawing units (including metres). A fixed
      // minimum of 0.1 enlarges a 2 mm label in a metre-based sheet fiftyfold.
      const transformedHeight = height * Math.hypot(matrix[2], matrix[3])
      if (!(transformedHeight > 0)) { warn('Text 的 Height 或缩放无效，已跳过文字图元。'); return }
      append({ ...common, type: 'text', text, position: transform(position, matrix), height: transformedHeight, rotation: Math.atan2(dy, dx), align, verticalAlign, font: attr(element, 'Font') })
    }
  }
  function renderCatalogue(definition, instance, nodeId, base = IDENTITY, seen = new Set()) {
    if (seen.has(definition)) { warn('发现循环的 ShapeCatalogue 引用，已停止展开。'); return }
    const nextSeen = new Set(seen); nextSeen.add(definition)
    const matrix = multiply(base, multiply(matrixOf(instance), inverse(matrixOf(definition))))
    const todo = childrenOf(definition).slice().reverse()
    while (todo.length) {
      const element = todo.pop(), tag = tagOf(element)
      if (IGNORE_DRAWING.has(tag)) continue
      if (GEOMETRY.has(tag)) { renderGeometry(element, nodeId, matrix); continue }
      const reference = attr(element, 'ComponentName')
      if (reference && catalogue.has(reference)) renderCatalogue(catalogue.get(reference), element, nodeId, matrix, nextSeen)
      todo.push(...childrenOf(element).reverse())
    }
  }

  if (nativeDexpi) {
    warn('已读取 DEXPI 2.0 原生 Model 的 XML 层级与属性；此版本暂不渲染原生 DEXPI 2.0 图形映射。请导出 Proteus / DEXPI 1.x 以显示图纸。')
  } else {
    for (const node of nodes) {
      if (node.isCatalogue) continue
      const element = nodeToElement.get(node.id)
      if (tagOf(element.parentElement || root) === 'TrimmedCurve') continue
      if (GEOMETRY.has(node.tag)) renderGeometry(element, node.semanticId, IDENTITY)
      const reference = attr(element, 'ComponentName')
      // PlantStructureItem.ComponentName names a plant/site/section, not a
      // graphical symbol (HEX exports use e.g. DEXPI, Github and UNIT1).
      if (reference && !GEOMETRY.has(node.tag) && node.tag !== 'PlantStructureItem') {
        const definition = catalogue.get(reference)
        if (definition) {
          if (positionOf(element)) renderCatalogue(definition, element, node.semanticId)
          else warn(`符号 ${reference} 缺少 Position，未生成推测坐标。`)
        } else if (!childrenOf(element).some(child => GEOMETRY.has(tagOf(child)))) {
          warn(`未找到 ShapeCatalogue 符号：${reference}。`)
        }
      }
      if (['BSpline', 'BezierCurve', 'NurbsCurve', 'RasterImage', 'Image'].includes(node.tag)) warn(`尚未支持的图形类型：${node.tag}。`)
    }
  }

  for (const node of nodes) {
    if (node.isCatalogue) continue
    const element = nodeToElement.get(node.id)
    if (node.tag === 'Connection') {
      const fromXmlId = attr(element, 'FromID'), toXmlId = attr(element, 'ToID')
      const fromElement = resolve(fromXmlId), toElement = resolve(toXmlId)
      connections.push({ id: node.id, nodeId: node.semanticId, from: fromElement ? elementToNode.get(fromElement).id : null, to: toElement ? elementToNode.get(toElement).id : null, fromXmlId, toXmlId, fromNode: attr(element, 'FromNode'), toNode: attr(element, 'ToNode'), attributes: node.attributes })
      if (fromXmlId && !fromElement) warn(`未解析连接 FromID：${fromXmlId}。`)
      if (toXmlId && !toElement) warn(`未解析连接 ToID：${toXmlId}。`)
    }
    if (['Association', 'ObjectAttributesReference'].includes(node.tag)) {
      const reference = attr(element, 'ItemID')
      if (reference && !resolve(reference)) warn(`未解析 ${node.tag} 引用：${reference}。`)
    }
  }
  if (!primitives.length && !nativeDexpi) warn('未发现可绘制的图形坐标；仍可查看 XML 节点、属性与连接。')

  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const expand = point => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
    bounds.minX = Math.min(bounds.minX, point.x); bounds.minY = Math.min(bounds.minY, point.y)
    bounds.maxX = Math.max(bounds.maxX, point.x); bounds.maxY = Math.max(bounds.maxY, point.y)
  }
  const drawingNode = nodes.find(node => node.tag === 'Drawing' && !node.isCatalogue)
  const drawing = drawingNode && nodeToElement.get(drawingNode.id)
  const extent = drawing && direct(drawing, 'Extent') || direct(root, 'Extent')
  if (extent) { expand(pointOf(direct(extent, 'Min'))); expand(pointOf(direct(extent, 'Max'))) }
  for (const primitive of primitives) {
    if (primitive.points) primitive.points.forEach(expand)
    else if (primitive.position) expand(primitive.position)
  }
  if (!Number.isFinite(bounds.minX)) Object.assign(bounds, { minX: 0, minY: 0, maxX: 100, maxY: 100 })
  const degenerateSpan = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 1e-6 || millimetre
  if (bounds.maxX === bounds.minX) bounds.maxX += degenerateSpan
  if (bounds.maxY === bounds.minY) bounds.maxY += degenerateSpan
  const count = category => nodes.filter(node => !node.isCatalogue && node.isSemantic && node.category === category).length
  return {
    name: attr(drawing, 'Name', 'Title') || fileName, fileName,
    version: attr(info, 'ApplicationVersion') || (nativeDexpi ? '2.0' : attr(info, 'SchemaVersion') || '未知'),
    schemaVersion: attr(info, 'SchemaVersion'), format: nativeDexpi ? 'DEXPI XML' : 'Proteus XML', units: attr(info, 'Units') || 'drawing units',
    rootId: nodes[0].id, nodes, primitives, connections, bounds,
    stats: { nodeCount: nodes.length, equipment: count('equipment'), piping: count('piping'), instrumentation: count('instrumentation'), connections: connections.length, primitives: primitives.length },
    warnings,
    getNodeXml(id) {
      const element = nodeToElement.get(id)
      if (!element) return ''
      const Serializer = globalThis.XMLSerializer || document.defaultView?.XMLSerializer
      return Serializer ? new Serializer().serializeToString(element) : element.outerHTML
    },
  }
}
