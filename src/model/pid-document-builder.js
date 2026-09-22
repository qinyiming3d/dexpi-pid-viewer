import { PidDocumentData } from './pid-document-data.js'
import { createNodeInfo } from './node-info.js'

/** Adapt the current parser without retaining its DOM/source closure. */
export function buildPidDocument(parsed) {
  const {
    name,
    fileName,
    version,
    schemaVersion,
    format,
    units,
    rootId,
    bounds,
    stats,
  } = parsed
  const data = new PidDocumentData({
    name,
    fileName,
    version,
    schemaVersion,
    format,
    units,
    rootId,
    bounds,
    stats,
  })
  data.warnings = [...(parsed.warnings || [])]
  for (const record of parsed.nodes) {
    if (data.nodeMap.has(record.id)) {
      throw new Error('Duplicate node ID: ' + record.id)
    }
    const info = createNodeInfo(record)
    data.nodeMap.set(info.id, {
      info,
      attributes: record.attributes,
      properties: record.properties,
      semanticOwnerId: record.semanticId,
      graphicIds: [],
      connectionIds: [],
      source: {
        sourceId: record.id,
      },
      text: record.text,
      isCatalogue: record.isCatalogue,
      isSemantic: record.isSemantic,
    })
  }
  // Validate ownership in linear time, including unordered input and cycles.
  const complete = new Set()
  for (const node of data.nodeMap.values()) {
    const path = new Set()
    let info = node.info
    while (info && !complete.has(info.id)) {
      if (path.has(info.id)) {
        throw new Error('Cyclic ownership: ' + info.id)
      }
      path.add(info.id)
      if (info.ownerId != null && !data.nodeMap.has(info.ownerId)) {
        throw new Error('Missing owner: ' + info.ownerId)
      }
      info = data.getInfo(info.ownerId)
    }
    for (const id of path) complete.add(id)
  }
  for (const { info } of data.nodeMap.values()) {
    if (info.ownerId == null) {
      data.worldInfo.push(info)
    } else {
      data.getInfo(info.ownerId).children.push(info)
    }
  }
  for (const primitive of parsed.primitives || []) {
    if (data.graphicMap.has(primitive.id)) {
      throw new Error('Duplicate graphic ID: ' + primitive.id)
    }
    const owner = data.getNode(primitive.nodeId)
    if (!owner) {
      throw new Error('Missing graphic owner: ' + primitive.nodeId)
    }
    const graphic = {
      ...primitive,
      ownerId: primitive.nodeId,
    }
    data.graphicMap.set(graphic.id, graphic)
    owner.graphicIds.push(graphic.id)
  }
  for (const [index, connection] of (parsed.connections || []).entries()) {
    const id = connection.id ?? 'connection:' + index
    if (data.connectionMap.has(id)) {
      throw new Error('Duplicate connection ID: ' + id)
    }
    data.connectionMap.set(id, {
      ...connection,
      id,
    })
    for (const endpoint of new Set([connection.from, connection.to]))
      data.getNode(endpoint)?.connectionIds.push(id)
  }
  return data
}
