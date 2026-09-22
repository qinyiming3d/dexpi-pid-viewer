/** Small DOM readers shared by semantic and graphics parsing. */
export function tagOf(element) {
  return element.localName || element.nodeName.split(':').pop()
}

export function childrenOf(element) {
  return Array.from(element.children || [])
}

export function direct(element, tag) {
  return childrenOf(element).find((child) => tagOf(child) === tag)
}

export function attr(element, ...names) {
  if (!element) {
    return ''
  }
  for (const name of names) {
    if (element.hasAttribute(name)) {
      return element.getAttribute(name)
    }
    const attribute = Array.from(element.attributes).find(
      (candidate) => candidate.localName === name
    )
    if (attribute) {
      return attribute.value
    }
  }
  return ''
}

export function numberAttr(element, names, fallback = NaN) {
  const value = attr(element, ...[].concat(names))
  if (value === '') {
    return fallback
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function pointOf(element) {
  if (!element) {
    return null
  }
  const x = numberAttr(element, ['X', 'x'])
  const y = numberAttr(element, ['Y', 'y'])
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }
  return {
    x,
    y,
  }
}

export function positionOf(element) {
  const position = direct(element, 'Position')
  return (
    pointOf(position && direct(position, 'Location')) ||
    pointOf(direct(element, 'Location'))
  )
}

/** Read literal character data without including nested XML metadata. */
export function directText(element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === 3 || node.nodeType === 4)
    .map((node) => node.textContent)
    .join('')
    .trim()
}
