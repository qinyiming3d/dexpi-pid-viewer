import {
  tagOf,
} from './xml-utils.js'

const MAX_XML_LENGTH = 30 * 1024 * 1024

/** Validate input before any semantic or graphics parsing begins. */
export function readDexpiXml(xml) {
  if (typeof xml !== 'string' || !xml.trim()) {
    throw new Error('XML 文件为空。')
  }
  // FileReader / fs strings can retain a BOM; TextDecoder normally removes it.
  const source = xml.replace(/^\uFEFF/, '')
  if (source.length > MAX_XML_LENGTH) {
    throw new Error('XML 超过 30 MB，请使用较小的图纸。')
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new Error('不支持包含 DOCTYPE 或 ENTITY 声明的 XML。')
  }
  if (typeof DOMParser === 'undefined') {
    throw new Error('当前环境不支持 DOMParser。')
  }
  const document = new DOMParser().parseFromString(source, 'application/xml')
  const parseError =
    document.getElementsByTagName('parsererror')[0] ||
    document.getElementsByTagNameNS('*', 'parsererror')[0]
  if (parseError) {
    throw new Error('XML 语法错误：' + parseError.textContent.trim().slice(0, 240))
  }
  const root = document.documentElement
  const rootTag = tagOf(root)
  const nativeDexpi =
    rootTag === 'Model' &&
    (/dexpi/i.test(root.namespaceURI || '') || /dexpi/i.test(source.slice(0, 8000)))
  if (rootTag !== 'PlantModel' && !nativeDexpi) {
    throw new Error(
      '不是受支持的 DEXPI XML：需要 PlantModel（Proteus）或 DEXPI Model 根节点。'
    )
  }
  return {
    document,
    root,
    nativeDexpi,
  }
}
