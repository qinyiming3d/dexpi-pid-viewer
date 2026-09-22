export function primitiveSelectionId(primitive) {
  return !primitive.isCatalogueGeometry && primitive.sourceNodeId
    ? primitive.sourceNodeId
    : `primitive:${primitive.id}`
}

/** Keep the XML nodes and add one selectable leaf for each catalogue occurrence. */
export function createSelectionNodes(model) {
  const nodes = [...(model?.nodes || [])]
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const extraChildren = new Map()
  for (const primitive of model?.primitives || []) {
    const id = primitiveSelectionId(primitive)
    if (byId.has(id)) {
      continue
    }
    const source = byId.get(primitive.sourceNodeId)
    const parentId = primitive.instanceNodeId || primitive.nodeId
    const siblings = extraChildren.get(parentId) || []
    const tag = source?.tag || primitive.type
    const node = {
      id,
      xmlId: '',
      tag,
      label: primitive.text || `${tag} ${siblings.length + 1}`,
      category: byId.get(primitive.nodeId)?.category || 'drawing',
      parentId,
      childIds: [],
      attributes: source?.attributes || {},
      properties: source?.properties || [],
      text: primitive.text || '',
      isCatalogue: false,
      isSemantic: false,
      semanticId: primitive.nodeId,
      isPrimitiveInstance: true,
      primitiveId: primitive.id,
      sourceNodeId: primitive.sourceNodeId,
    }
    nodes.push(node)
    byId.set(id, node)
    siblings.push(id)
    extraChildren.set(parentId, siblings)
  }
  // Never mutate parsed XML child lists or export counts for UI-only leaves.
  return nodes.map((node) =>
    extraChildren.has(node.id)
      ? {
          ...node,
          childIds: [...node.childIds, ...extraChildren.get(node.id)],
        }
      : node
  )
}
