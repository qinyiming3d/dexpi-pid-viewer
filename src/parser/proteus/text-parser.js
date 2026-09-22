import {
  attr,
  childrenOf,
  direct,
  directText,
  tagOf,
} from '../xml/xml-utils.js'
import {
  readPropertyValue,
} from './property-parser.js'

/** Resolve literal and property-backed labels using this document's node index. */
export function createTextResolver({
  nodeToElement,
  resolve,
  warn,
}) {
  function referencedText(reference, owner, literal = false) {
    const expression = attr(reference, 'DependantAttribute', 'DependentAttribute')
    const itemId = attr(reference, 'ItemID')
    if (literal && !itemId) {
      return expression
    }
    const target = itemId ? resolve(itemId) : owner
    if (!target) {
      warn(`未解析文字引用 ItemID：${itemId}。`)
      return ''
    }
    const contents =
      attr(reference, 'DependantAttributeContents', 'DependentAttributeContents') ||
      'Value'

    function lookup(name) {
      const value = readPropertyValue(target, name, contents)
      if (value !== null) {
        return value
      }
      warn(`未解析文字属性：${itemId || attr(target, 'ID') || tagOf(target)} / ${name}。`)
      return ''
    }

    if (/\[[^\]]+\]/.test(expression)) {
      return expression.replace(/\[([^\]]+)\]/g, (_, name) => lookup(name))
    }
    return expression ? lookup(expression) : ''
  }

  return function textOf(element, nodeId) {
    const explicit = attr(element, 'String', 'Value')
    if (explicit) {
      return explicit
    }
    const owner = nodeToElement.get(nodeId)
    const specification = direct(element, 'TextStringFormatSpecification')
    if (specification) {
      return childrenOf(specification)
        .filter((child) => tagOf(child) === 'ObjectAttributesReference')
        .map((reference) => referencedText(reference, owner, true))
        .join('')
    }
    if (attr(element, 'DependantAttribute', 'DependentAttribute')) {
      return referencedText(element, owner)
    }
    return directText(element)
  }
}
