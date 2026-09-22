export function createNodeInfo(node) {
  return {
    id: node.id,
    xmlId: node.xmlId,
    type: node.tag,
    category: node.category,
    name: node.label,
    ownerId: node.parentId ?? null,
    children: [],
  }
}
