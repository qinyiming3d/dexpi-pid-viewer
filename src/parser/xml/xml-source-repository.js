/** Optional source access for the inspector. Never included in the parser DTO. */
export class XmlSourceRepository {
  constructor(document, nodeToElement) {
    this.document = document
    this.nodeToElement = nodeToElement
  }

  getElement(nodeId) {
    return this.nodeToElement.get(nodeId) ?? null
  }

  getXml(nodeId) {
    const element = this.getElement(nodeId)
    if (!element) {
      return ''
    }

    const Serializer = globalThis.XMLSerializer || this.document.defaultView?.XMLSerializer
    if (Serializer) {
      return new Serializer().serializeToString(element)
    }
    return element.outerHTML
  }
}
