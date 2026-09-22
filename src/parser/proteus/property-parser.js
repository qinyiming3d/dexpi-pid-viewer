import {
  attr,
  childrenOf,
  tagOf,
} from '../xml/xml-utils.js'

const LABEL_PROPERTY =
  /^(TagName|EquipmentTagName|PipingComponentNumber|ProcessInstrumentationFunctionNumber|InstrumentationLoopFunctionNumber|ActuatingSystemNumber|SegmentNumber|LineNumber)(AssignmentClass)?$/

function propertyGroups(element) {
  return childrenOf(element).filter((child) => tagOf(child) === 'GenericAttributes')
}

export function parseGenericProperties(element) {
  const properties = []
  for (const group of propertyGroups(element)) {
    for (const property of childrenOf(group)) {
      if (tagOf(property) !== 'GenericAttribute') {
        continue
      }
      properties.push({
        name: attr(property, 'Name'),
        value: attr(property, 'Value') || property.textContent.trim(),
        unit: attr(property, 'Units', 'Unit', 'UnitsOfMeasure'),
        source: attr(group, 'Set') || 'GenericAttributes',
        format: attr(property, 'Format'),
        language: attr(property, 'Language'),
        uri: attr(property, 'AttributeURI'),
      })
    }
  }
  return properties
}

export function readNodeLabel(element, properties) {
  const tag = tagOf(element)
  const preferred = properties.find(
    (property) => LABEL_PROPERTY.test(property.name) && property.value
  )
  return (
    attr(element, 'TagName') ||
    preferred?.value ||
    attr(element, 'Name', 'name', 'ComponentClass', 'ComponentName', 'ID', 'id') ||
    (tag === 'Text' ? attr(element, 'String').slice(0, 60) : '') ||
    tag
  )
}

/** Return null for a missing property; an existing empty value stays empty. */
export function readPropertyValue(element, name, contents = 'Value') {
  // References can name an XML attribute or a GenericAttribute on the same object.
  if (contents === 'Value' && element.hasAttribute(name)) {
    return attr(element, name)
  }
  for (const group of propertyGroups(element)) {
    const property = childrenOf(group).find(
      (child) => tagOf(child) === 'GenericAttribute' && attr(child, 'Name') === name
    )
    if (property) {
      return (
        attr(property, contents) ||
        (contents === 'Value' ? property.textContent.trim() : '')
      )
    }
  }
  return null
}
