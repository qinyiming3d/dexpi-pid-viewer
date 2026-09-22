import {
  attr,
  childrenOf,
  tagOf,
} from '../xml/xml-utils.js'
import {
  IDENTITY,
  inverse,
  multiply,
} from '../../graphics/transform.js'
import {
  GEOMETRY,
  IGNORE_DRAWING,
} from './domain-tags.js'
import {
  matrixOf,
} from './transform-reader.js'

const CATALOGUE_WRAPPERS = new Set(['Group', 'Representation'])

/** Index definitions, never the nested references inside a definition. */
export function indexCatalogueDefinitions(nodes, nodeToElement) {
  const catalogue = new Map()
  for (const node of nodes) {
    if (node.tag !== 'ShapeCatalogue') {
      continue
    }
    const pending = childrenOf(nodeToElement.get(node.id)).reverse()
    while (pending.length) {
      const element = pending.pop()
      const tag = tagOf(element)
      if (GEOMETRY.has(tag) || IGNORE_DRAWING.has(tag)) {
        continue
      }
      const componentName = attr(element, 'ComponentName')
      const xmlId = attr(element, 'ID', 'id')
      if (componentName) {
        catalogue.set(componentName, element)
      }
      if (xmlId) {
        catalogue.set(xmlId, element)
      }
      // Unnamed groups may arrange definitions; named groups are definitions.
      if (!componentName && CATALOGUE_WRAPPERS.has(tag)) {
        pending.push(...childrenOf(element).reverse())
      }
    }
  }
  return catalogue
}

/** Expand one instance while retaining the outer instance's selection identity. */
export function createCatalogueExpander({
  catalogue,
  appendGeometry,
  warn,
}) {
  return function expandCatalogue(
    definition,
    instance,
    nodeId,
    instanceNodeId,
    base = IDENTITY,
    seen = new Set()
  ) {
    if (seen.has(definition)) {
      warn('发现循环的 ShapeCatalogue 引用，已停止展开。')
      return
    }
    const nextSeen = new Set(seen)
    nextSeen.add(definition)
    const matrix = multiply(
      base,
      multiply(matrixOf(instance), inverse(matrixOf(definition)))
    )
    const pending = childrenOf(definition).reverse()
    while (pending.length) {
      const element = pending.pop()
      const tag = tagOf(element)
      if (IGNORE_DRAWING.has(tag)) {
        continue
      }
      if (GEOMETRY.has(tag)) {
        appendGeometry(element, nodeId, matrix, {
          isCatalogueGeometry: true,
          instanceNodeId,
        })
        continue
      }
      const reference = attr(element, 'ComponentName')
      if (reference && catalogue.has(reference)) {
        expandCatalogue(
          catalogue.get(reference),
          element,
          nodeId,
          instanceNodeId,
          matrix,
          nextSeen
        )
      }
      pending.push(...childrenOf(element).reverse())
    }
  }
}
