import {
  attr,
  childrenOf,
  positionOf,
  tagOf,
} from '../xml/xml-utils.js'
import {
  IDENTITY,
} from '../../graphics/transform.js'
import {
  GEOMETRY,
} from './domain-tags.js'
import {
  createTextResolver,
} from './text-parser.js'
import {
  createGeometryParser,
} from './geometry-parser.js'
import {
  createCatalogueExpander,
  indexCatalogueDefinitions,
} from './catalogue-parser.js'

const UNSUPPORTED_GRAPHICS = new Set(['BSpline', 'BezierCurve', 'NurbsCurve', 'RasterImage', 'Image'])

function isSymbolInstance(node, reference) {
  // PlantStructureItem.ComponentName identifies plant structure, not a symbol.
  return Boolean(reference) && !GEOMETRY.has(node.tag) && node.tag !== 'PlantStructureItem'
}

/** Coordinate drawing traversal; geometry and symbol expansion own their details. */
export function parseGraphics({
  root,
  nodes,
  nodeToElement,
  elementToNode,
  resolve,
  warn,
  millimetre,
  defaultLineWeight,
}) {
  const primitives = []
  const catalogue = indexCatalogueDefinitions(nodes, nodeToElement)
  const textOf = createTextResolver({
    nodeToElement,
    resolve,
    warn,
  })
  const parseGeometry = createGeometryParser({
    textOf,
    warn,
    millimetre,
    defaultLineWeight,
  })
  let catalogueGeometryOrder = 0
  const appendGeometry = (
    element,
    nodeId,
    matrix,
    {
      isCatalogueGeometry = false,
      instanceNodeId,
    } = {}
  ) => {
    const catalogueOrder = isCatalogueGeometry ? catalogueGeometryOrder++ : null
    const geometry = parseGeometry(element, nodeId, matrix)
    if (!geometry) {
      return
    }
    primitives.push({
      nodeId,
      sourceNodeId: elementToNode.get(element)?.id,
      instanceNodeId,
      isCatalogueGeometry,
      catalogueOrder,
      ...geometry,
      id: 'p' + primitives.length,
    })
  }
  const expandCatalogue = createCatalogueExpander({
    catalogue,
    appendGeometry,
    warn,
  })

  for (const node of nodes) {
    if (node.isCatalogue) {
      continue
    }
    const element = nodeToElement.get(node.id)
    // The parent TrimmedCurve already emits its circle or ellipse as one arc.
    if (tagOf(element.parentElement || root) === 'TrimmedCurve') {
      continue
    }
    if (GEOMETRY.has(node.tag)) {
      appendGeometry(element, node.semanticId, IDENTITY)
    }
    const reference = attr(element, 'ComponentName')
    if (isSymbolInstance(node, reference)) {
      const definition = catalogue.get(reference)
      if (definition) {
        if (positionOf(element)) {
          expandCatalogue(definition, element, node.semanticId, node.id)
        } else {
          warn(`符号 ${reference} 缺少 Position，未生成推测坐标。`)
        }
      } else if (!childrenOf(element).some((child) => GEOMETRY.has(tagOf(child)))) {
        warn(`未找到 ShapeCatalogue 符号：${reference}。`)
      }
    }
    if (UNSUPPORTED_GRAPHICS.has(node.tag)) {
      warn(`尚未支持的图形类型：${node.tag}。`)
    }
  }
  return primitives
}
