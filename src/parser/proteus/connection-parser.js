import {
  attr,
} from '../xml/xml-utils.js'

function readConnection(node, element, elementToNode, resolve, warn) {
  const fromXmlId = attr(element, 'FromID')
  const toXmlId = attr(element, 'ToID')
  const fromElement = resolve(fromXmlId)
  const toElement = resolve(toXmlId)
  const connection = {
    id: node.id,
    nodeId: node.semanticId,
    from: fromElement ? elementToNode.get(fromElement).id : null,
    to: toElement ? elementToNode.get(toElement).id : null,
    fromXmlId,
    toXmlId,
    fromNode: attr(element, 'FromNode'),
    toNode: attr(element, 'ToNode'),
    attributes: node.attributes,
  }
  if (fromXmlId && !fromElement) {
    warn(`未解析连接 FromID：${fromXmlId}。`)
  }
  if (toXmlId && !toElement) {
    warn(`未解析连接 ToID：${toXmlId}。`)
  }
  return connection
}

/** Keep connection endpoints tied to XML nodes, separate from graphics ownership. */
export function parseConnections({
  nodes,
  nodeToElement,
  elementToNode,
  resolve,
  warn,
}) {
  const connections = []
  for (const node of nodes) {
    if (node.isCatalogue) {
      continue
    }
    const element = nodeToElement.get(node.id)
    if (node.tag === 'Connection') {
      connections.push(readConnection(node, element, elementToNode, resolve, warn))
    }
    if (node.tag === 'Association' || node.tag === 'ObjectAttributesReference') {
      const reference = attr(element, 'ItemID')
      if (reference && !resolve(reference)) {
        warn(`未解析 ${node.tag} 引用：${reference}。`)
      }
    }
  }
  return connections
}
