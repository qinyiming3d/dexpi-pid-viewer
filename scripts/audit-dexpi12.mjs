import {
  readFileSync,
} from 'node:fs'
import {
  basename,
  relative,
  resolve,
} from 'node:path'
import {
  fileURLToPath,
} from 'node:url'
import {
  JSDOM,
} from 'jsdom'
import {
  parseDexpi,
} from '../src/parser/parse-dexpi.js'
import {
  decodeXml,
  xmlFiles,
} from './audit-corpus.mjs'

const defaultDirectory = fileURLToPath(new URL('../dexpi_data/dexpi 1.2/', import.meta.url))
const geometryTags = new Set(['Line', 'PolyLine', 'Polyline', 'CenterLine', 'Shape', 'Polygon', 'Circle', 'Ellipse', 'TrimmedCurve', 'Text'])

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1
}

function attributes(element) {
  return Object.fromEntries(Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]))
}

function direct(element, name) {
  return Array.from(element.children).find((child) => child.localName === name)
}

function group(values) {
  const counts = {}
  for (const value of values) {
    increment(counts, value)
  }
  return counts
}

/** Read only the 1.2 corpus; record source conventions separately from rendered DTOs. */
export function auditDexpi12(directory = defaultDirectory) {
  const dom = new JSDOM()
  globalThis.DOMParser = dom.window.DOMParser
  globalThis.XMLSerializer = dom.window.XMLSerializer
  const parser = new DOMParser()
  const results = []
  for (const path of xmlFiles(directory)) {
    const file = relative(directory, path).replaceAll('\\', '/')
    try {
      const xml = decodeXml(readFileSync(path))
      const document = parser.parseFromString(xml, 'application/xml')
      const elements = Array.from(document.querySelectorAll('*'))
      const presentations = elements.filter((element) => element.localName === 'Presentation')
      const texts = elements.filter((element) => element.localName === 'Text')
      const geometry = elements.filter((element) => geometryTags.has(element.localName))
      const missingDirectPresentation = geometry.filter((element) => !direct(element, 'Presentation'))
      const inheritedPresentation = missingDirectPresentation.filter((element) => {
        let parent = element.parentElement
        while (parent) {
          if (direct(parent, 'Presentation')) {
            return true
          }
          parent = parent.parentElement
        }
        return false
      })
      const sourceColorCounts = group(presentations.map((element) => {
        return ['Color', 'R', 'G', 'B'].map((name) => element.getAttribute(name) ?? '(absent)').join('|')
      }))
      const model = parseDexpi(xml, {
        fileName: basename(path),
      })
      const entry = {
        file,
        status: 'ok',
        origin: document.querySelector('PlantInformation')?.getAttribute('OriginatingSystem'),
        primitives: model.primitives.length,
        sourceGeometry: group(geometry.map((element) => element.localName)),
        sourceColorCounts,
        sourceLineTypes: group(presentations.map((element) => element.getAttribute('LineType') || '(absent)')),
        sourceFill: group(elements.filter((element) => element.hasAttribute('Filled') || element.hasAttribute('Fill')).map((element) => `${element.localName}|${element.getAttribute('Filled') || element.getAttribute('Fill')}`)),
        sourceTextJustification: group(texts.map((element) => element.getAttribute('Justification') || '(absent)')),
        sourceTextFont: group(texts.map((element) => element.getAttribute('Font') || '(absent)')),
        multilineText: texts.filter((element) => /[\r\n]/.test(element.getAttribute('String') || '')).length,
        textWithWidth: texts.filter((element) => element.hasAttribute('Width')).length,
        textWithExtent: texts.filter((element) => direct(element, 'Extent')).length,
        geometryWithoutPresentation: group(missingDirectPresentation.map((element) => element.localName)),
        geometryWithAncestorPresentation: group(inheritedPresentation.map((element) => element.localName)),
        rgbOutsideNormalizedRange: presentations.filter((element) => ['R', 'G', 'B'].some((name) => Number(element.getAttribute(name)) > 1 || Number(element.getAttribute(name)) < 0)).map(attributes),
        outputColorCounts: group(model.primitives.map((primitive) => primitive.color)),
        outputTypes: group(model.primitives.map((primitive) => primitive.type)),
        warnings: model.warnings,
      }
      results.push(entry)
    } catch (error) {
      results.push({
        file,
        status: 'error',
        error: error.message,
      })
    }
  }
  dom.window.close()
  const parsed = results.filter((result) => result.status === 'ok')
  return {
    summary: {
      files: results.length,
      parsed: parsed.length,
      failed: results.length - parsed.length,
      zeroGeometry: parsed.filter((result) => result.primitives === 0).length,
      warnings: group(parsed.flatMap((result) => result.warnings).map((warning) => warning.split(/[：:]/)[0])),
      filesWithMultilineText: parsed.filter((result) => result.multilineText > 0).length,
      filesWithRgbOutsideNormalizedRange: parsed.filter((result) => result.rgbOutsideNormalizedRange.length > 0).length,
    },
    results,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(auditDexpi12(process.argv[2] ? resolve(process.argv[2]) : defaultDirectory), null, 2))
}
