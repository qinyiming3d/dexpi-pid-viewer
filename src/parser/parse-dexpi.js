import { computeDocumentBounds } from '../graphics/bounds.js'
import { createDiagnostics } from './diagnostics.js'
import { readDexpiXml } from './xml/xml-reader.js'
import { XmlSourceRepository } from './xml/xml-source-repository.js'
import { parseNodes } from './proteus/node-parser.js'
import { parseConnections } from './proteus/connection-parser.js'
import { parseGraphics } from './proteus/graphics-parser.js'
import {
  readDocumentInfo,
  readDrawingExtent,
  readDrawingSettings,
  summarizeDocument,
} from './proteus/document-info.js'

/**
 * Parse XML into a plain-data document. No DOM nodes, Vue state or functions escape.
 * The existing node/primitive field names are retained for consumers during migration.
 */
export function parseDexpi(xml, options = {}) {
  return parseDocument(xml, options).dto
}

/** Read the same DTO and optionally retain XML source access for an inspector. */
export function parseDexpiSource(xml, options = {}) {
  const result = parseDocument(xml, options)
  return {
    dto: result.dto,
    sourceRepository: new XmlSourceRepository(result.document, result.nodeToElement),
  }
}

function parseDocument(xml, options) {
  const {
    fileName = '未命名.xml',
  } = options
  const {
    document,
    root,
    nativeDexpi,
  } = readDexpiXml(xml)
  const {
    warnings,
    warn,
  } = createDiagnostics()
  const {
    nodes,
    nodeToElement,
    elementToNode,
    resolve,
  } = parseNodes(root, warn)
  const settings = readDrawingSettings(root)

  let primitives = []
  if (nativeDexpi) {
    warn(
      '已读取 DEXPI 2.0 原生 Model 的 XML 层级与属性；此版本暂不渲染原生 DEXPI 2.0 图形映射。请导出 Proteus / DEXPI 1.x 以显示图纸。'
    )
  } else {
    primitives = parseGraphics({
      root,
      nodes,
      nodeToElement,
      elementToNode,
      resolve,
      warn,
      ...settings,
    })
  }

  const connections = parseConnections({
    nodes,
    nodeToElement,
    elementToNode,
    resolve,
    warn,
  })
  if (!primitives.length && !nativeDexpi) {
    warn('未发现可绘制的图形坐标；仍可查看 XML 节点、属性与连接。')
  }

  const drawingNode = nodes.find((node) => node.tag === 'Drawing' && !node.isCatalogue)
  const drawing = drawingNode && nodeToElement.get(drawingNode.id)
  const extent = readDrawingExtent(root, drawing)
  const dto = {
    ...readDocumentInfo(root, drawing, fileName, nativeDexpi),
    rootId: nodes[0].id,
    nodes,
    primitives,
    connections,
    bounds: computeDocumentBounds(primitives, extent, settings.millimetre),
    stats: summarizeDocument(nodes, primitives, connections),
    warnings,
  }

  return {
    dto,
    document,
    nodeToElement,
  }
}
