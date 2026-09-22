import { createSelectionNodes } from '../../lib/primitive-selection.js'
const SEMANTIC_TAGS =
  /^(PlantModel|Model|Drawing|Equipment|Nozzle|PipingNetworkSystem|PipingNetworkSegment|PipingComponent|ProcessInstrument|InstrumentationLoopFunction|ProcessInstrumentationFunction|Actuating.*|ProcessSignal.*|InformationFlow|InstrumentConnection|PlantArea|PlantInformation|MetaData|MetaInformation|Association|Component|PipeConnectorSymbol|SignalConnectorSymbol)$/

/** Compatibility view records: domain ownership remains in PidDocumentData. */
export function createTreeNodes(data) {
  if (!data) {
    return Object.freeze({})
  }
  const nodes = [...data.nodeMap.values()].map((node) => {
    const info = node.info
    return {
      ...node,
      id: info.id,
      get xmlId() {
        return info.xmlId
      },
      get tag() {
        return info.type
      },
      get label() {
        return info.name
      },
      get category() {
        return info.category
      },
      get parentId() {
        return info.ownerId
      },
      get childIds() {
        return info.children.map((child) => child.id)
      },
      semanticId: node.semanticOwnerId,
    }
  })
  const projected = createSelectionNodes({
    nodes,
    primitives: [...data.graphicMap.values()],
  })
  for (const node of projected) {
    const info = data.getInfo(node.id)
    if (!info) {
      continue
    }
    for (const [field, key] of Object.entries({
      label: 'name',
      tag: 'type',
      category: 'category',
      xmlId: 'xmlId',
      parentId: 'ownerId',
    })) {
      Object.defineProperty(node, field, {
        enumerable: true,
        configurable: true,
        get: () => info[key],
      })
    }
  }
  return Object.freeze(Object.fromEntries(projected.map((node) => [node.id, node])))
}
export function createTree(data, byId, mode = 'model') {
  if (!data) {
    return {
      entries: [],
      children: {},
      parents: {},
      roots: [],
    }
  }
  const nodes = Object.values(byId),
    graphics = [...data.graphicMap.values()]
  const entries = [],
    children = {},
    parents = {},
    included = new Set(),
    catalogue = new Set()
  const drawnSources = new Set(graphics.map((p) => p.sourceNodeId))
  for (const node of nodes) {
    if (
      node.isCatalogue ||
      node.tag === 'ShapeCatalogue' ||
      catalogue.has(node.parentId)
    ) {
      catalogue.add(node.id)
    }
    if (
      mode === 'xml' ||
      (!catalogue.has(node.id) &&
        (node.id === data.documentInfo.rootId ||
          SEMANTIC_TAGS.test(node.tag) ||
          node.tag === 'Label' ||
          drawnSources.has(node.id) ||
          node.isPrimitiveInstance ||
          (node.xmlId &&
            ['equipment', 'piping', 'instrumentation'].includes(node.category))))
    ) {
      entries.push(node)
      included.add(node.id)
    }
  }
  const roots = []
  for (const node of entries) {
    let p = node.parentId
    while (p && !included.has(p)) p = byId[p]?.parentId
    parents[node.id] = p || null
    if (p) {
      ;(children[p] || (children[p] = [])).push(node.id)
    } else {
      roots.push(node.id)
    }
  }
  return {
    entries,
    children,
    parents,
    roots,
  }
}
export function searchTree(tree, query) {
  if (!query.trim()) {
    return null
  }
  const q = query.trim().toLowerCase()
  const matches = new Set()
  for (const node of tree.entries) {
    if (
      (
        node.label +
        ' ' +
        node.xmlId +
        ' ' +
        node.tag +
        ' ' +
        Object.values(node.attributes).join(' ')
      )
        .toLowerCase()
        .includes(q)
    ) {
      let id = node.id
      while (id && !matches.has(id)) {
        matches.add(id)
        id = tree.parents[id]
      }
    }
  }
  return matches
}
export function visibleTreeRows(tree, byId, matches, expanded, limit = 1000) {
  const rows = [],
    stack = tree.roots
      .map((id) => ({
        id,
        depth: 0,
      }))
      .reverse()
  while (stack.length && rows.length < limit) {
    const {
      id,
      depth,
    } = stack.pop()
    if (matches && !matches.has(id)) {
      continue
    }
    const children = tree.children[id] || []
    rows.push({
      node: byId[id],
      depth,
      hasChildren: !!children.length,
      childCount: children.length,
    })
    if (matches || expanded[id]) {
      for (let i = children.length - 1; i >= 0; i--)
        stack.push({
          id: children[i],
          depth: depth + 1,
        })
    }
  }
  return rows
}
