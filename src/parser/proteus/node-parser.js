import {
  attr,
  childrenOf,
  directText,
  tagOf,
} from '../xml/xml-utils.js'
import {
  categoryOf,
  isSemanticTag,
} from './domain-tags.js'
import {
  parseGenericProperties,
  readNodeLabel,
} from './property-parser.js'

const MAX_DEPTH = 256
const MAX_NODES = 100000

function createNode(element, context, id) {
  const tag = tagOf(element)
  const componentClass = attr(element, 'ComponentClass')
  const properties = parseGenericProperties(element)
  const category = categoryOf(tag, componentClass)
  const isSemantic = isSemanticTag(tag, category, componentClass)
  return {
    id,
    xmlId: attr(element, 'ID', 'id'),
    tag,
    label: readNodeLabel(element, properties),
    category,
    parentId: context.parentId,
    childIds: [],
    attributes: Object.fromEntries(
      Array.from(element.attributes).map((attribute) => [attribute.name, attribute.value])
    ),
    properties,
    text: directText(element),
    isCatalogue: context.catalogue || tag === 'ShapeCatalogue',
    isSemantic,
    semanticId: isSemantic ? id : context.ownerId || id,
  }
}

function indexXmlId(element, xmlId, idToElements, warn) {
  if (!xmlId) {
    return
  }
  if (!idToElements.has(xmlId)) {
    idToElements.set(xmlId, [])
  }
  const matches = idToElements.get(xmlId)
  matches.push(element)
  if (matches.length > 1) {
    warn(`重复的 XML ID：${xmlId}；保留全部节点，并优先解析非符号库对象。`)
  }
}

/**
 * Build XML hierarchy and semantic ownership without generating graphics.
 * The DOM indexes and resolver belong only to this parse invocation.
 */
export function parseNodes(root, warn) {
  const nodes = []
  const nodeMap = new Map()
  const elementToNode = new WeakMap()
  const idToElements = new Map()
  const nodeToElement = new Map()
  const stack = [
    {
      element: root,
      parentId: null,
      catalogue: false,
      ownerId: null,
      depth: 0,
    },
  ]
  while (stack.length) {
    const context = stack.pop()
    const element = context.element
    if (context.depth > MAX_DEPTH) {
      throw new Error('XML 节点嵌套超过 256 层，无法安全解析。')
    }
    if (nodes.length >= MAX_NODES) {
      throw new Error('XML 超过 100,000 个节点，请按图纸拆分。')
    }
    const node = createNode(element, context, 'n' + nodes.length)
    nodes.push(node)
    nodeMap.set(node.id, node)
    elementToNode.set(element, node)
    nodeToElement.set(node.id, element)
    if (node.parentId) {
      nodeMap.get(node.parentId).childIds.push(node.id)
    }
    indexXmlId(element, node.xmlId, idToElements, warn)

    // Reverse the push order so the iterative walk preserves XML document order.
    const children = childrenOf(element)
    for (let index = children.length - 1; index >= 0; index--) {
      stack.push({
        element: children[index],
        parentId: node.id,
        catalogue: node.isCatalogue,
        ownerId: node.isSemantic ? node.id : context.ownerId,
        depth: context.depth + 1,
      })
    }
  }

  function resolve(reference) {
    const xmlId = (reference || '').replace(/^#/, '')
    const matches = idToElements.get(xmlId) || []
    return (
      matches.find((element) => !elementToNode.get(element).isCatalogue) ||
      matches[0] ||
      null
    )
  }

  return {
    nodes,
    nodeToElement,
    elementToNode,
    resolve,
  }
}
