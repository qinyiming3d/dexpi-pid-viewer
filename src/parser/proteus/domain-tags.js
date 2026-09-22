export const GEOMETRY = new Set([
  'PolyLine',
  'Polyline',
  'Line',
  'CenterLine',
  'Shape',
  'Polygon',
  'Circle',
  'Ellipse',
  'TrimmedCurve',
  'Text',
])

export const IGNORE_DRAWING = new Set([
  'Position',
  'Scale',
  'Location',
  'Axis',
  'Reference',
  'Extent',
  'Min',
  'Max',
  'Presentation',
  'Coordinate',
  'ConnectionPoints',
  'Node',
  'GenericAttributes',
  'GenericAttribute',
  'Association',
  'Connection',
  'PersistentID',
  'NominalDiameter',
  'TextStringFormatSpecification',
])

const EQUIPMENT = new Set(['Equipment', 'Nozzle', 'EquipmentComponent'])
const PIPING = new Set([
  'PipingNetworkSystem',
  'PipingNetworkSegment',
  'PipingComponent',
  'PipeOffPageConnector',
  'PipeConnectorSymbol',
  'PipeFlowArrow',
  'PipeSlopeSymbol',
  'InsulationSymbol',
  'PropertyBreak',
  'ConnectionPoints',
  'Node',
])
const INSTRUMENTATION =
  /^(Instrumentation|Instrument|ProcessInstrumentation|ProcessSignal|Actuating|Signal|InformationFlow)/
const METADATA = new Set([
  'MetaData',
  'PlantInformation',
  'UnitsOfMeasure',
  'GenericAttributes',
  'GenericAttribute',
  'Association',
  'Connection',
  'PersistentID',
  'NominalDiameter',
])
const DRAWING_CONTAINERS = new Set([
  'Drawing',
  'DrawingBorder',
  'Label',
  'ShapeCatalogue',
  'Representation',
  'Group',
])
const NON_SEMANTIC = new Set(['ConnectionPoints', 'Node', 'Label', 'ShapeCatalogue'])
const SEMANTIC_CATEGORIES = new Set(['equipment', 'piping', 'instrumentation'])

/** Tag rules take precedence over an exporter's optional ComponentClass. */
export function categoryOf(tag, componentClass) {
  if (EQUIPMENT.has(tag)) {
    return 'equipment'
  }
  if (PIPING.has(tag)) {
    return 'piping'
  }
  if (INSTRUMENTATION.test(tag)) {
    return 'instrumentation'
  }
  if (METADATA.has(tag)) {
    return 'metadata'
  }
  if (GEOMETRY.has(tag) || DRAWING_CONTAINERS.has(tag)) {
    return 'drawing'
  }
  if (componentClass) {
    if (/Pump|Tank|Vessel|Exchanger|Chamber|Equipment/.test(componentClass)) {
      return 'equipment'
    }
    if (/Valve|Piping|Pipe/.test(componentClass)) {
      return 'piping'
    }
    if (/Instrument|Signal|Actuat/.test(componentClass)) {
      return 'instrumentation'
    }
  }
  return 'other'
}

export function isSemanticTag(tag, category, componentClass) {
  return (
    !GEOMETRY.has(tag) &&
    !NON_SEMANTIC.has(tag) &&
    (SEMANTIC_CATEGORIES.has(category) ||
      tag === 'Drawing' ||
      tag === 'MetaData' ||
      Boolean(componentClass))
  )
}
