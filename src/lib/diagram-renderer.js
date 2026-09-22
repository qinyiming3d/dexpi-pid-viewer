import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'

const CATEGORY_COLORS = {
  equipment: '#3c596b',
  piping: '#4b6c7e',
  instrumentation: '#546b81',
  drawing: '#81909b',
  metadata: '#81909b',
  other: '#526573',
}
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const isPoint = (point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))
const emptyBounds = () => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
const validBounds = (bounds) => bounds && [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite) && bounds.maxX >= bounds.minX && bounds.maxY >= bounds.minY

function mergeBounds(target, bounds) {
  if (!validBounds(bounds)) return target
  target.minX = Math.min(target.minX, bounds.minX)
  target.minY = Math.min(target.minY, bounds.minY)
  target.maxX = Math.max(target.maxX, bounds.maxX)
  target.maxY = Math.max(target.maxY, bounds.maxY)
  return target
}

function niceStep(value) {
  const power = Math.pow(10, Math.floor(Math.log10(Math.max(value, 1e-12))))
  const ratio = value / power
  return power * (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10)
}

/**
 * An on-demand Three.js renderer for world-space, Y-up P&ID primitives.
 * It owns only its canvas; Vue owns selection state and surrounding controls.
 */
export class DiagramRenderer {
  constructor(container, { onSelect, onViewChange, onError } = {}) {
    this.container = container
    this.onSelect = onSelect || (() => {})
    this.onViewChange = onViewChange || (() => {})
    this.onError = onError || (() => {})
    this.disposed = false
    this.model = null
    this.selectedId = null
    this.nodes = new Map()
    this.children = new Map()
    this.objects = []
    this.nodeBounds = new Map()
    this.materials = new Map()
    this.textCache = new Map()
    this.layers = Object.fromEntries(Object.keys(CATEGORY_COLORS).map((key) => [key, true]))
    this.gridVisible = true
    this.labelsVisible = true
    this.center = new THREE.Vector2()
    this.scale = 1
    this.fitScale = 1
    this.width = 1
    this.height = 1
    this.frame = null
    this.pointer = null
    this.scene = new THREE.Scene()
    this.diagram = new THREE.Group()
    this.selection = new THREE.Group()
    this.grid = new THREE.Group()
    this.scene.add(this.grid, this.diagram, this.selection)
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000)
    this.camera.position.z = 1000
    this.raycaster = new THREE.Raycaster()
    this.unitPlane = new THREE.PlaneGeometry(1, 1)
    this.selectionMaterial = new THREE.LineBasicMaterial({ color: '#068fc0', depthTest: false, transparent: true, opacity: 1 })
    this.selectionBoxMaterial = new THREE.LineDashedMaterial({ color: '#1299c7', depthTest: false, transparent: true, opacity: 0.8, dashSize: 1, gapSize: 1 })
    this.gridMaterial = new THREE.LineBasicMaterial({ color: '#e2e9ee', transparent: true, opacity: 0.7, depthTest: false })
    this.gridMajorMaterial = new THREE.LineBasicMaterial({ color: '#d7e1e8', transparent: true, opacity: 0.65, depthTest: false })
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    } catch (error) {
      this.onError(new Error(`无法创建 WebGL 画布：${error.message}`))
      throw error
    }
    this.renderer.setClearColor(0xffffff, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.canvas = this.renderer.domElement
    this.canvas.className = 'diagram-webgl-canvas'
    this.canvas.setAttribute('role', 'img')
    this.canvas.setAttribute('aria-label', 'P&ID 流程图。拖动平移，滚轮缩放，单击选择，双击定位。')
    this.canvas.tabIndex = 0
    Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'grab', outline: 'none' })
    container.appendChild(this.canvas)
    this.listeners = []
    this.listen('pointerdown', this.pointerDown.bind(this))
    this.listen('pointermove', this.pointerMove.bind(this))
    this.listen('pointerup', this.pointerUp.bind(this))
    this.listen('pointercancel', this.pointerCancel.bind(this))
    this.listen('lostpointercapture', this.pointerCancel.bind(this))
    this.listen('pointerleave', () => { if (!this.pointer) this.canvas.style.cursor = 'grab' })
    this.listen('wheel', this.wheel.bind(this), { passive: false })
    this.listen('dblclick', this.doubleClick.bind(this))
    this.listen('keydown', this.keyDown.bind(this))
    this.listen('contextmenu', (event) => event.preventDefault())
    this.listen('webglcontextlost', (event) => {
      event.preventDefault()
      this.onError(new Error('WebGL 画布连接已中断，请重新载入页面。'))
    })
    this.listen('webglcontextrestored', () => this.requestRender())
    this.onResize = () => this.resize()
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.onResize)
      this.resizeObserver.observe(container)
    } else {
      window.addEventListener('resize', this.onResize)
    }
    this.resize()
  }

  listen(type, handler, options) {
    this.canvas.addEventListener(type, handler, options)
    this.listeners.push([type, handler, options])
  }

  setModel(model) {
    this.clearModel()
    this.model = model
    this.nodes = new Map((model?.nodes || []).map((node) => [node.id, node]))
    this.children = new Map()
    this.nodes.forEach((node) => {
      if (node.parentId) {
        if (!this.children.has(node.parentId)) this.children.set(node.parentId, [])
        this.children.get(node.parentId).push(node.id)
      }
    })
    for (const primitive of model?.primitives || []) {
      const category = this.categoryOf(primitive.nodeId)
      const object = primitive.type === 'text' ? this.createText(primitive, category) : this.createShape(primitive, category)
      if (!object) continue
      object.userData = { nodeId: primitive.nodeId, category, primitive, isText: primitive.type === 'text' }
      object.visible = this.isVisible(object)
      this.diagram.add(object)
      this.objects.push(object)
      object.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(object)
      if (!box.isEmpty()) {
        const bounds = { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y }
        object.userData.bounds = bounds
        for (const id of new Set([primitive.nodeId, primitive.sourceNodeId].filter(Boolean))) {
          if (!this.nodeBounds.has(id)) this.nodeBounds.set(id, emptyBounds())
          mergeBounds(this.nodeBounds.get(id), bounds)
        }
      }
    }
    this.allBounds = emptyBounds()
    this.nodeBounds.forEach((bounds) => mergeBounds(this.allBounds, bounds))
    // Text extents can be absent from XML extent declarations.
    mergeBounds(this.allBounds, model?.bounds)
    if (!validBounds(this.allBounds)) this.allBounds = { minX: 0, minY: 0, maxX: 100, maxY: 70 }
    this.fit()
  }

  categoryOf(id) {
    const category = this.nodes.get(id)?.category || 'other'
    return Object.prototype.hasOwnProperty.call(CATEGORY_COLORS, category) ? category : 'other'
  }

  colorOf(primitive, category) {
    // Presentation colours are part of the drawing (for example coloured
    // process/signal lines), not a semantic-category styling hint.
    if (primitive.color && typeof primitive.color === 'string') return primitive.color
    return CATEGORY_COLORS[category]
  }

  lineMaterial(primitive, category) {
    const color = this.colorOf(primitive, category)
    const lineType = String(primitive.lineType || '').trim().toLowerCase()
    const dashed = Boolean(primitive.dashed) || /^(2|dash|dashed|dot|dotted)$/.test(lineType)
    const weight = Math.abs(finite(primitive.lineWeight, 0.25)) || 0.25
    // Proteus type 2 in the reference SVG uses 5/7 times the line weight.
    // Deriving lengths from the source weight also supports metre drawings.
    const dashSize = weight * (lineType === '2' ? 5 : /^dot/.test(lineType) ? 1 : 6)
    const gapSize = weight * (lineType === '2' ? 7 : 3.2)
    const key = `${color}:${weight}:${dashed}:${dashed ? `${dashSize}:${gapSize}` : ''}`
    if (!this.materials.has(key)) {
      // WebGL's basic line primitive is always one screen pixel wide. Line2
      // preserves Proteus LineWeight in drawing units, including metre sheets.
      // Convert width to pixels using the orthographic scale. Keeping the
      // shader in screen units avoids precision loss for sub-millimetre lines
      // viewed by a camera thousands of drawing units away.
      const material = new LineMaterial({ color, linewidth: weight * (this.scale || 1), worldUnits: false, dashed, dashSize, gapSize, depthTest: false, depthWrite: false, transparent: true, opacity: 1, alphaToCoverage: true, toneMapped: false })
      material.userData.lineWeight = weight
      material.resolution.set(this.width, this.height)
      this.materials.set(key, material)
    }
    return this.materials.get(key)
  }

  pointsFor(primitive) {
    if (primitive.type === 'circle' || primitive.type === 'ellipse') {
      const center = primitive.center || primitive.position
      if (!isPoint(center)) return []
      const rx = Math.abs(finite(primitive.rx, finite(primitive.radius)))
      const ry = Math.abs(finite(primitive.ry, finite(primitive.radius, rx)))
      if (!rx || !ry) return []
      const rotation = finite(primitive.rotation)
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const points = []
      for (let i = 0; i < 96; i += 1) {
        const angle = (i / 96) * Math.PI * 2
        const x = Math.cos(angle) * rx
        const y = Math.sin(angle) * ry
        points.push(new THREE.Vector3(finite(center.x) + x * cos - y * sin, finite(center.y) + x * sin + y * cos, 0))
      }
      return points
    }
    return (primitive.points || []).filter(isPoint).map((point) => new THREE.Vector3(Number(point.x), Number(point.y), 0))
  }

  createShape(primitive, category) {
    const points = this.pointsFor(primitive)
    if (points.length < 2) return null
    const closed = primitive.closed || ['polygon', 'circle', 'ellipse'].includes(primitive.type)
    const catalogueOrder = primitive.isCatalogueGeometry ? 1.5 + finite(primitive.catalogueOrder) * 1e-4 : 1.5
    if (closed && primitive.filled && points.length >= 3) {
      const shape = new THREE.Shape(points.map((point) => new THREE.Vector2(point.x, point.y)))
      const key = `fill:${this.colorOf(primitive, category)}`
      // Filled catalogue geometry is a white backplate in the reference SVG.
      // Keep it in the transparent render list so it can be ordered after the
      // process line and before the catalogue outline.
      if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshBasicMaterial({ color: this.colorOf(primitive, category), side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: 1, toneMapped: false }))
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.materials.get(key))
      mesh.renderOrder = catalogueOrder
      return mesh
    }
    const material = this.lineMaterial(primitive, category)
    if (closed && !points[0].equals(points.at(-1))) points.push(points[0].clone())
    const geometry = new LineGeometry().setPositions(points.flatMap(point => [point.x, point.y, point.z]))
    const line = new Line2(geometry, material)
    if (material.dashed) line.computeLineDistances()
    // Preserve the source catalogue order: a symbol's backplate must cover
    // earlier strokes (such as the X in a ball valve), while its border stays
    // visible when it is drawn later. Ordinary process lines remain behind it.
    line.renderOrder = primitive.isCatalogueGeometry ? catalogueOrder : category === 'drawing' ? 0 : 1
    return line
  }

  createText(primitive, category) {
    const text = String(primitive.text ?? '').trimEnd()
    const position = primitive.position || primitive.center
    if (!text || !isPoint(position)) return null
    const height = Math.abs(finite(primitive.height, 2.5)) || 2.5
    const color = this.colorOf(primitive, category)
    const font = String(primitive.font || 'Arial').replace(/[\u0000-\u001f]/g, ' ').trim() || 'Arial'
    const key = `${text}\u0000${color}\u0000${font}`
    let cached = this.textCache.get(key)
    if (!cached) {
      const fontSize = 48
      const padding = 4
      const lineHeight = 58
      const lines = text.split(/\r?\n/).slice(0, 24)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const canvasFont = `${fontSize}px ${JSON.stringify(font)}, Arial, "Microsoft YaHei", sans-serif`
      ctx.font = canvasFont
      const metrics = lines.map((line) => ctx.measureText(line))
      const measuredWidth = Math.max(...metrics.map((metric) => metric.width), 1)
      const ascent = Math.max(...metrics.map((metric) => finite(metric.actualBoundingBoxAscent, fontSize * 0.8)), 1)
      const descent = Math.max(...metrics.map((metric) => finite(metric.actualBoundingBoxDescent, fontSize * 0.2)), 0)
      const naturalWidth = Math.ceil(measuredWidth + padding * 2)
      const naturalHeight = Math.ceil(ascent + descent + lineHeight * (lines.length - 1) + padding * 2)
      const resolution = Math.min(1, 2048 / naturalWidth, 2048 / naturalHeight)
      canvas.width = Math.max(1, Math.ceil(naturalWidth * resolution))
      canvas.height = Math.max(1, Math.ceil(naturalHeight * resolution))
      ctx.scale(resolution, resolution)
      ctx.font = canvasFont
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = color
      lines.forEach((line, index) => ctx.fillText(line, padding, padding + ascent + lineHeight * index))
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      // A sheet can shrink 48px glyphs to just a few screen pixels. Without
      // mipmaps, minification samples isolated texels and breaks thin strokes.
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = true
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
      cached = { texture, material, widthRatio: naturalWidth / fontSize, heightRatio: naturalHeight / fontSize, paddingRatio: padding / fontSize, inkCenterFromBaseline: (ascent - descent - lineHeight * (lines.length - 1)) / (2 * fontSize), extraLinesRatio: lineHeight * (lines.length - 1) / fontSize }
      this.textCache.set(key, cached)
    }
    const width = cached.widthRatio * height
    const textHeight = cached.heightRatio * height
    const align = String(primitive.align || primitive.horizontalAlign || 'left').toLowerCase()
    const vertical = String(primitive.verticalAlign || 'bottom').toLowerCase()
    const padding = cached.paddingRatio * height
    const offsetX = align === 'center' || align === 'middle' ? 0 : align === 'right' ? -width / 2 + padding : width / 2 - padding
    // The companion SVGs apply vertical justification along the drawing Y
    // axis, even for rotated text. Keep this baseline adjustment separate
    // from the local glyph offsets so e.g. the 90-degree F.C. label aligns.
    const blockHeight = (1 + cached.extraLinesRatio) * height
    const baselineOffset = vertical === 'top' ? -height : vertical === 'middle' || vertical === 'center' ? blockHeight / 2 - height : blockHeight - height
    const offsetY = cached.inkCenterFromBaseline * height
    const rotation = finite(primitive.rotation)
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const mesh = new THREE.Mesh(this.unitPlane, cached.material)
    mesh.scale.set(width, textHeight, 1)
    mesh.position.set(Number(position.x) + offsetX * cos - offsetY * sin, Number(position.y) + baselineOffset + offsetX * sin + offsetY * cos, 0.1)
    mesh.rotation.z = rotation
    mesh.renderOrder = 2
    return mesh
  }

  descendantIds(nodeId) {
    const ids = new Set()
    const stack = [nodeId]
    while (stack.length) {
      const id = stack.pop()
      if (ids.has(id)) continue
      ids.add(id)
      stack.push(...(this.children.get(id) || []))
    }
    return ids
  }

  boundsFor(nodeId) {
    const bounds = emptyBounds()
    this.descendantIds(nodeId).forEach((id) => mergeBounds(bounds, this.nodeBounds.get(id)))
    return validBounds(bounds) ? bounds : null
  }

  selectionRenderOrder(object) {
    const primitive = object.userData?.primitive
    return primitive?.isCatalogueGeometry ? 3 + finite(primitive.catalogueOrder) * 1e-4 : 3
  }

  select(nodeId, { focus = false } = {}) {
    this.selectedId = nodeId || null
    this.clearSelection()
    if (this.selectedId) {
      const ids = this.descendantIds(this.selectedId)
      for (const object of this.objects) {
        if ((!ids.has(object.userData.nodeId) && !ids.has(object.userData.primitive?.sourceNodeId)) || !object.visible) continue
        if (object.userData.isText) {
          // Render coloured glyphs rather than tinting the original texture:
          // multiplying a black glyph by the selection colour stays black.
          const highlight = this.createText({ ...object.userData.primitive, color: '#068fc0' }, object.userData.category)
          if (!highlight) continue
          highlight.position.z = 0.2
          highlight.renderOrder = 3
          highlight.userData = { sharedGeometry: true }
          this.selection.add(highlight)
        } else if (object.userData.primitive?.filled && object.isMesh) {
          // Keep the symbol's backplate in the selection layer. Otherwise the
          // highlighted catalogue strokes are drawn over the white circle and
          // reveal the X that the source symbol intentionally occludes.
          const highlight = object.clone()
          highlight.position.z = 0.2
          highlight.renderOrder = this.selectionRenderOrder(object)
          highlight.userData = { sharedGeometry: true }
          this.selection.add(highlight)
        } else if (object.isLine || object.isLine2) {
          const highlight = object.clone()
          highlight.material = object.isLine2 ? object.material.clone() : this.selectionMaterial
          if (object.isLine2) {
            highlight.material.color.set('#068fc0')
            highlight.material.dashed = false
            highlight.material.linewidth = Math.max(object.material.linewidth, 1.5)
          }
          highlight.position.z = 0.2
          highlight.renderOrder = this.selectionRenderOrder(object)
          highlight.userData = { sharedGeometry: true, ownsMaterial: Boolean(object.isLine2) }
          this.selection.add(highlight)
        }
      }
      this.selectionBounds = this.boundsFor(this.selectedId)
      if (this.selectionBounds) {
        this.selectionBox = new THREE.Line(new THREE.BufferGeometry(), this.selectionBoxMaterial)
        this.selectionBox.renderOrder = 4
        this.selection.add(this.selectionBox)
        this.updateSelectionBox()
      }
      if (focus) this.focus(this.selectedId)
    }
    this.requestRender()
  }

  updateSelectionBox() {
    if (!this.selectionBox || !this.selectionBounds) return
    const bounds = this.selectionBounds
    const pad = 7 / this.scale
    const x1 = bounds.minX - pad
    const y1 = bounds.minY - pad
    const x2 = bounds.maxX + pad
    const y2 = bounds.maxY + pad
    this.selectionBox.geometry.setFromPoints([
      new THREE.Vector3(x1, y1, 0.3), new THREE.Vector3(x2, y1, 0.3), new THREE.Vector3(x2, y2, 0.3), new THREE.Vector3(x1, y2, 0.3), new THREE.Vector3(x1, y1, 0.3),
    ])
    this.selectionBox.computeLineDistances()
    this.selectionBoxMaterial.dashSize = 5 / this.scale
    this.selectionBoxMaterial.gapSize = 4 / this.scale
  }

  fit() {
    if (!validBounds(this.allBounds)) return
    this.fitScale = this.scaleForBounds(this.allBounds, 48)
    this.scale = this.fitScale
    this.center.set((this.allBounds.minX + this.allBounds.maxX) / 2, (this.allBounds.minY + this.allBounds.maxY) / 2)
    this.applyCamera()
  }

  scaleForBounds(bounds, padding = 48) {
    const spanX = bounds.maxX - bounds.minX
    const spanY = bounds.maxY - bounds.minY
    // A4 is 0.297 x 0.210 when Units="m". A one-unit minimum incorrectly
    // shrinks those sheets, so only protect degenerate axes relative to size.
    const minSpan = Math.max(spanX, spanY) * 1e-6 || 1
    const width = Math.max(spanX, minSpan)
    const height = Math.max(spanY, minSpan)
    const scale = Math.min(Math.max(this.width - padding * 2, this.width * 0.7) / width, Math.max(this.height - padding * 2, this.height * 0.7) / height)
    return Number.isFinite(scale) && scale > 0 ? scale : 1
  }

  focus(nodeId) {
    const bounds = this.boundsFor(nodeId)
    if (!bounds) return false
    this.center.set((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2)
    this.scale = Math.min(this.scaleForBounds(bounds, 90), this.fitScale * 24)
    this.applyCamera()
    return true
  }

  zoomBy(factor, screenPoint) {
    if (!Number.isFinite(factor) || factor <= 0) return
    const previousScale = this.scale
    this.scale = THREE.MathUtils.clamp(previousScale * factor, this.fitScale * 0.1, this.fitScale * 100)
    if (screenPoint) {
      const x = screenPoint.x - this.width / 2
      const y = this.height / 2 - screenPoint.y
      this.center.x += x / previousScale - x / this.scale
      this.center.y += y / previousScale - y / this.scale
    }
    this.applyCamera()
  }

  applyCamera() {
    if (this.disposed) return
    this.materials.forEach(material => {
      if (material.isLineMaterial) {
        material.linewidth = material.userData.lineWeight * this.scale
        material.resolution.set(this.width, this.height)
      }
    })
    this.selection.children.forEach(object => {
      if (object.isLine2) object.material.linewidth = Math.max(object.material.userData.lineWeight * this.scale, 1.5)
    })
    const halfWidth = this.width / this.scale / 2
    const halfHeight = this.height / this.scale / 2
    this.camera.left = -halfWidth
    this.camera.right = halfWidth
    this.camera.top = halfHeight
    this.camera.bottom = -halfHeight
    this.camera.position.set(this.center.x, this.center.y, 1000)
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
    this.updateGrid()
    this.updateSelectionBox()
    this.onViewChange({ zoom: Math.round(this.scale / this.fitScale * 100), center: { x: this.center.x, y: this.center.y } })
    this.requestRender()
  }

  updateGrid() {
    this.grid.children.forEach((object) => object.geometry.dispose())
    this.grid.clear()
    this.grid.visible = this.gridVisible
    if (!this.gridVisible) return
    const step = niceStep(24 / this.scale)
    const left = this.center.x - this.width / this.scale / 2
    const right = this.center.x + this.width / this.scale / 2
    const bottom = this.center.y - this.height / this.scale / 2
    const top = this.center.y + this.height / this.scale / 2
    const major = []
    const minor = []
    for (let i = Math.floor(left / step); i <= Math.ceil(right / step); i += 1) {
      const target = i % 5 === 0 ? major : minor
      target.push(new THREE.Vector3(i * step, bottom, -1), new THREE.Vector3(i * step, top, -1))
    }
    for (let i = Math.floor(bottom / step); i <= Math.ceil(top / step); i += 1) {
      const target = i % 5 === 0 ? major : minor
      target.push(new THREE.Vector3(left, i * step, -1), new THREE.Vector3(right, i * step, -1))
    }
    for (const [points, material] of [[minor, this.gridMaterial], [major, this.gridMajorMaterial]]) {
      const object = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), material)
      object.renderOrder = -10
      this.grid.add(object)
    }
  }

  setLayers(layers = {}) {
    Object.assign(this.layers, layers)
    this.objects.forEach((object) => { object.visible = this.isVisible(object) })
    this.select(this.selectedId)
    this.requestRender()
  }

  isVisible(object) {
    return this.layers[object.userData.category] !== false && (!object.userData.isText || this.labelsVisible)
  }

  setGrid(visible) {
    this.gridVisible = Boolean(visible)
    this.updateGrid()
    this.requestRender()
  }

  setLabels(visible) {
    this.labelsVisible = Boolean(visible)
    this.objects.forEach((object) => { object.visible = this.isVisible(object) })
    this.select(this.selectedId)
    this.requestRender()
  }

  localPoint(event) {
    const rect = this.canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  hitTest(event) {
    if (!this.model) return null
    const point = this.localPoint(event)
    this.raycaster.params.Line.threshold = 5 / this.scale
    this.raycaster.params.Line2 = { threshold: 10 }
    this.raycaster.setFromCamera(new THREE.Vector2(point.x / this.width * 2 - 1, 1 - point.y / this.height * 2), this.camera)
    this.diagram.updateMatrixWorld(true)
    const hits = this.raycaster.intersectObjects(this.objects.filter((object) => object.visible), false)
    if (!hits.length) return null
    // Small symbols take precedence over a sheet outline or a long pipe behind them.
    const worldPoint = { x: this.center.x + (point.x - this.width / 2) / this.scale, y: this.center.y + (this.height / 2 - point.y) / this.scale }
    hits.sort((a, b) => {
      const score = (hit) => {
        const bounds = hit.object.userData.bounds
        if (!bounds) return Infinity
        const area = Math.max((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY), 1 / (this.scale * this.scale))
        const distance = Math.hypot(hit.point.x - worldPoint.x, hit.point.y - worldPoint.y) * this.scale
        return distance + Math.log1p(area * this.scale * this.scale) * 0.1 + (hit.object.userData.category === 'drawing' ? 5 : 0)
      }
      return score(a) - score(b)
    })
    const picked = hits[0].object.userData
    const sourceId = picked.primitive?.sourceNodeId
    return (picked.isText && !this.nodes.get(sourceId)?.isCatalogue && sourceId) || picked.nodeId || null
  }

  pointerDown(event) {
    if (event.button !== 0 && event.button !== 1) return
    if (this.pointer) return
    event.preventDefault()
    this.canvas.focus({ preventScroll: true })
    this.pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, dragged: false }
    this.canvas.setPointerCapture(event.pointerId)
    this.canvas.style.cursor = 'grabbing'
  }

  pointerMove(event) {
    if (!this.pointer) {
      this.canvas.style.cursor = this.hitTest(event) ? 'pointer' : 'grab'
      return
    }
    if (event.pointerId !== this.pointer.id) return
    const pointer = this.pointer
    const total = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY)
    if (total > 3) pointer.dragged = true
    if (pointer.dragged) {
      this.center.x -= (event.clientX - pointer.lastX) / this.scale
      this.center.y += (event.clientY - pointer.lastY) / this.scale
      this.applyCamera()
    }
    pointer.lastX = event.clientX
    pointer.lastY = event.clientY
  }

  pointerUp(event) {
    if (!this.pointer || event.pointerId !== this.pointer.id) return
    const dragged = this.pointer.dragged
    this.pointer = null
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    if (!dragged && event.button === 0) {
      const id = this.hitTest(event)
      this.select(id)
      this.onSelect(id)
    }
    this.canvas.style.cursor = this.hitTest(event) ? 'pointer' : 'grab'
  }

  pointerCancel() {
    this.pointer = null
    this.canvas.style.cursor = 'grab'
  }

  wheel(event) {
    event.preventDefault()
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1)
    this.zoomBy(Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.0018), this.localPoint(event))
  }

  doubleClick(event) {
    event.preventDefault()
    const id = this.hitTest(event)
    if (id) {
      this.select(id, { focus: true })
      this.onSelect(id)
    } else this.fit()
  }

  keyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const key = event.key
    // App-level shortcuts handle fit, focus, selection and zoom. Arrow panning
    // belongs to the canvas only, avoiding a second action as events bubble.
    if (key.startsWith('Arrow')) {
      const amount = (event.shiftKey ? 100 : 35) / this.scale
      if (key === 'ArrowLeft') this.center.x -= amount
      if (key === 'ArrowRight') this.center.x += amount
      if (key === 'ArrowUp') this.center.y += amount
      if (key === 'ArrowDown') this.center.y -= amount
      this.applyCamera()
    } else return
    event.preventDefault()
  }

  resize() {
    if (this.disposed) return
    const rect = this.container.getBoundingClientRect()
    const previousWidth = this.width
    const previousHeight = this.height
    this.width = Math.max(1, rect.width)
    this.height = Math.max(1, rect.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(this.width, this.height, false)
    if (this.allBounds) {
      const zoomRatio = this.scale / this.fitScale
      this.fitScale = this.scaleForBounds(this.allBounds, 48)
      if (Math.abs(zoomRatio - 1) < 0.01 || previousWidth <= 1 || previousHeight <= 1) this.scale = this.fitScale
    }
    this.applyCamera()
  }

  requestRender() {
    if (this.disposed || this.frame !== null) return
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null
      if (this.disposed) return
      try { this.renderer.render(this.scene, this.camera) } catch (error) { this.onError(error) }
    })
  }

  exportPng() {
    // Compose an opaque sheet so the exported image has the same legibility in
    // image viewers that otherwise show transparent PNGs on a black backdrop.
    this.renderer.render(this.scene, this.camera)
    const output = document.createElement('canvas')
    output.width = this.canvas.width
    output.height = this.canvas.height
    const ctx = output.getContext('2d')
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, output.width, output.height)
    ctx.drawImage(this.canvas, 0, 0)
    return output.toDataURL('image/png')
  }

  clearSelection() {
    this.selection.children.forEach((object) => {
      if (!object.userData.sharedGeometry) object.geometry?.dispose()
      if (object.userData.ownsMaterial) object.material?.dispose()
    })
    this.selection.clear()
    this.selectionBox = null
    this.selectionBounds = null
  }

  clearModel() {
    this.clearSelection()
    this.objects.forEach((object) => { if (object.geometry !== this.unitPlane) object.geometry?.dispose() })
    this.diagram.clear()
    this.materials.forEach((material) => material.dispose())
    this.textCache.forEach(({ texture, material }) => { texture.dispose(); material.dispose() })
    this.materials.clear()
    this.textCache.clear()
    this.nodeBounds.clear()
    this.objects = []
    this.selectedId = null
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.frame !== null) window.cancelAnimationFrame(this.frame)
    this.resizeObserver?.disconnect()
    window.removeEventListener('resize', this.onResize)
    this.listeners.forEach(([type, handler, options]) => this.canvas.removeEventListener(type, handler, options))
    this.clearModel()
    this.grid.children.forEach((object) => object.geometry.dispose())
    this.unitPlane.dispose()
    this.selectionMaterial.dispose()
    this.selectionBoxMaterial.dispose()
    this.gridMaterial.dispose()
    this.gridMajorMaterial.dispose()
    this.renderer.dispose()
    this.canvas.remove()
  }
}

export default DiagramRenderer
