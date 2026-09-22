import { attr, direct, pointOf } from '../xml/xml-utils.js'

const MILLIMETRE_IN_DRAWING_UNITS = {
  m: 0.001,
  metre: 0.001,
  meter: 0.001,
  cm: 0.1,
  centimetre: 0.1,
  centimeter: 0.1,
  in: 1 / 25.4,
  inch: 1 / 25.4,
  ft: 1 / 304.8,
  foot: 1 / 304.8,
}

/** Defaults follow drawing units; explicitly supplied coordinates are never rescaled. */
export function readDrawingSettings(root) {
  const information = direct(root, 'PlantInformation')
  const unit = attr(information, 'Units').toLowerCase()
  const millimetre = MILLIMETRE_IN_DRAWING_UNITS[unit] || 1

  return {
    millimetre,
    defaultLineWeight: 0.25 * millimetre,
  }
}

export function readDocumentInfo(root, drawing, fileName, nativeDexpi) {
  const information = direct(root, 'PlantInformation')
  return {
    name: attr(drawing, 'Name', 'Title') || fileName,
    fileName,
    version:
      attr(information, 'ApplicationVersion') ||
      (nativeDexpi ? '2.0' : attr(information, 'SchemaVersion') || '未知'),
    schemaVersion: attr(information, 'SchemaVersion'),
    format: nativeDexpi ? 'DEXPI XML' : 'Proteus XML',
    units: attr(information, 'Units') || 'drawing units',
  }
}

export function readDrawingExtent(root, drawing) {
  const extent = (drawing && direct(drawing, 'Extent')) || direct(root, 'Extent')
  if (!extent) {
    return []
  }
  return [
    pointOf(direct(extent, 'Min')),
    pointOf(direct(extent, 'Max')),
  ].filter(Boolean)
}

export function summarizeDocument(nodes, primitives, connections) {
  const stats = {
    nodeCount: nodes.length,
    equipment: 0,
    piping: 0,
    instrumentation: 0,
    connections: connections.length,
    primitives: primitives.length,
  }

  for (const node of nodes) {
    if (node.isCatalogue || !node.isSemantic) {
      continue
    }
    if (['equipment', 'piping', 'instrumentation'].includes(node.category)) {
      stats[node.category] += 1
    }
  }
  return stats
}
