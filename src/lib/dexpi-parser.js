import { parseDexpiSource } from '../parser/parse-dexpi.js'

/**
 * Compatibility entry for older consumers that call model.getNodeXml().
 * New code uses parser/parse-dexpi.js and keeps source access separate from data.
 */
export function parseDexpi(xml, options = {}) {
  const {
    dto,
    sourceRepository,
  } = parseDexpiSource(xml, options)

  return {
    ...dto,
    getNodeXml(id) {
      return sourceRepository.getXml(id)
    },
  }
}
