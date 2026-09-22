/** Framework-independent canonical document. Only info objects may be reactive. */
export class PidDocumentData {
  constructor(documentInfo) {
    this.documentInfo = documentInfo
    this.nodeMap = new Map()
    this.graphicMap = new Map()
    this.connectionMap = new Map()
    this.worldInfo = []
    this.warnings = []
  }
  getNode(id) {
    return this.nodeMap.get(id) ?? null
  }
  getInfo(id) {
    return this.getNode(id)?.info ?? null
  }
  getOwner(id) {
    return this.getNode(this.getInfo(id)?.ownerId)
  }
  getOwnerInfo(id) {
    return this.getOwner(id)?.info ?? null
  }
  getChildren(id) {
    return this.getInfo(id)?.children ?? []
  }
  getGraphics(id) {
    return (this.getNode(id)?.graphicIds ?? []).map((id) => this.graphicMap.get(id))
  }
}
