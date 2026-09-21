import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { parseDexpi } from '../src/lib/dexpi-parser.js'

export const defaultCorpus = fileURLToPath(new URL('../../TrainingTestCases-master/', import.meta.url))

export function xmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? xmlFiles(path) : /\.xml$/i.test(entry.name) ? [path] : []
  }).sort()
}

export function decodeXml(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer)
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer)
  const encoding = buffer.toString('ascii', 0, 200).match(/encoding\s*=\s*["']([^"']+)/i)?.[1] || 'utf-8'
  return new TextDecoder(encoding).decode(buffer)
}

export function auditCorpus(directory = defaultCorpus, inspectModel) {
  const { window } = new JSDOM()
  globalThis.DOMParser = window.DOMParser
  globalThis.XMLSerializer = window.XMLSerializer
  const files = xmlFiles(directory)
  const results = []
  for (const path of files) {
    const entry = { file: relative(directory, path).replaceAll('\\', '/') }
    try {
      const xml = decodeXml(readFileSync(path))
      const model = parseDexpi(xml, { fileName: basename(path) })
      const byId = new Map(model.nodes.map(node => [node.id, node]))
      const textNodes = model.nodes.filter(node => node.tag === 'Text' && !node.isCatalogue)
      const text = model.primitives.filter(primitive => primitive.type === 'text')
      const geometricPoints = model.primitives.flatMap(primitive => primitive.points || [primitive.position])
      const sourceHeights = textNodes.map(node => Number(node.attributes.Height)).filter(value => value > 0)
      const sourceDrawingCoordinates = model.nodes.filter(node => !node.isCatalogue && ['Coordinate', 'Location'].includes(node.tag) && Number.isFinite(Number(node.attributes.X)) && Number.isFinite(Number(node.attributes.Y))).length
      const directHeightMismatches = text.filter(primitive => {
        const source = byId.get(primitive.sourceNodeId)
        const height = Number(source?.attributes.Height)
        return source && !source.isCatalogue && height > 0 && Math.abs(primitive.height - height) > height * 1e-9
      }).length
      Object.assign(entry, {
        status: 'ok', units: model.units, nodes: model.nodes.length, primitives: model.primitives.length,
        textNodes: textNodes.length, textPrimitives: text.length,
        formattedTextNodes: textNodes.filter(node => node.childIds.some(id => byId.get(id)?.tag === 'TextStringFormatSpecification')).length,
        textWithoutString: textNodes.filter(node => !node.attributes.String && !node.attributes.Value).length,
        textWithPlaceholders: textNodes.filter(node => /\[[^\]]+\]/.test(node.attributes.String || '')).length,
        smallText: sourceHeights.filter(value => value < 0.1).length,
        dependentTextWithoutString: textNodes.filter(node => !node.attributes.String && !node.attributes.Value && node.attributes.DependantAttribute).length,
        sourceDrawingCoordinates, directHeightMismatches,
        invalidPoints: geometricPoints.filter(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)).length,
        invalidOwners: model.primitives.filter(primitive => !byId.has(primitive.nodeId) || byId.get(primitive.nodeId).isCatalogue).length,
        minSourceTextHeight: sourceHeights.length ? Math.min(...sourceHeights) : null,
        minRenderedTextHeight: text.length ? Math.min(...text.map(primitive => primitive.height)) : null,
        bounds: model.bounds,
        warnings: model.warnings,
      })
      inspectModel?.(model, entry)
    } catch (error) {
      Object.assign(entry, { status: 'error', error: error.message })
    }
    results.push(entry)
  }
  window.close()
  const ok = results.filter(entry => entry.status === 'ok')
  const warningCounts = {}
  for (const entry of ok) {
    for (const warning of entry.warnings) {
      const category = warning.split(/[：:]/)[0]
      warningCounts[category] = (warningCounts[category] || 0) + 1
    }
  }
  return {
    summary: {
      total: results.length, parsed: ok.length, failed: results.length - ok.length,
      zeroGeometry: ok.filter(entry => entry.primitives === 0).length,
      unexpectedZeroGeometry: ok.filter(entry => entry.primitives === 0 && entry.sourceDrawingCoordinates > 0).length,
      invalidGeometry: ok.filter(entry => entry.invalidPoints || entry.invalidOwners).length,
      filesWithChangedDirectTextHeights: ok.filter(entry => entry.directHeightMismatches).length,
      filesWithSmallText: ok.filter(entry => entry.smallText).length,
      filesWithDependentTextWithoutString: ok.filter(entry => entry.dependentTextWithoutString).length,
      dependentTextWithoutString: ok.reduce((count, entry) => count + entry.dependentTextWithoutString, 0),
      filesWithFormattedText: ok.filter(entry => entry.formattedTextNodes).length,
      filesWithPlaceholderText: ok.filter(entry => entry.textWithPlaceholders).length,
      warningCounts,
    },
    results,
  }
}

export function markdownReport(report) {
  const { summary, results } = report
  return [
    '# TrainingTestCases 解析检查', '',
    `检查 ${summary.total} 个 XML（包括大写 .XML）：${summary.parsed} 个语法解析成功，${summary.failed} 个失败；${summary.parsed - summary.zeroGeometry} 个生成图元，${summary.zeroGeometry} 个源文件没有图形坐标。`, '',
    '检查覆盖所有 XML 的语法、图元坐标有限性、图元所属节点、原始字高保留、缺失属性和引用告警。没有逐像素验证全部 PPT / PNG；告警为零不代表图像与参考完全一致。C02 的 63 个文字、94 个 path、10 个 polygon 另有 SVG 回归对照（文本、字号、变换后顶点和完整圆弧采样）。', '',
    '具体例：dexpi 1.3/example pids/E01 Tank/E01V02-VER.EX01.xml 已读取 27 个节点，包括 T4750 储罐及两个 Chamber 的属性；文件没有 Drawing、Position、轮廓线或 ShapeCatalogue，所以图元数为 0。相邻 PPTX 是独立参考资料，不提供给 XML 解析器可直接还原的排版坐标。', '',
    `共有 ${summary.filesWithSmallText} 个文件含小于 0.1 drawing unit 的明确字高。修复前这些字号被截为 0.1；目前 ${summary.filesWithChangedDirectTextHeights} 个文件仍有直接文字字号不一致。米单位 C02 的 0.002 曾被放大 50 倍，C03 的 0.005 曾被放大 20 倍。`, '',
    `共有 ${summary.filesWithDependentTextWithoutString} 个文件的 ${summary.dependentTextWithoutString} 个 Text 没有 String / Value，而以 DependantAttribute + ItemID 引用属性。现在尝试解析表达式；源属性本身缺失时保留告警。1.3 C01/C02/C03 的 TextStringFormatSpecification 均另有显式 String，以显式文本为准。`, '',
    '18 个文件的 CenterLine 没有有效坐标，全部属于下列 42 个无图形文件（例如 NumPoints="0"）。源文件只提供设备、属性和连接关系，同目录 PPT / PNG 是参考示意图，XML 本身不足以还原原始排版。此类文件应显示明确提示，不应虚构坐标。', '',
    '## 无图形坐标的源文件', '',
    ...results.filter(entry => entry.status === 'ok' && !entry.primitives).map(entry => `- ${entry.file}`), '',
    '## 全量结果', '',
    '| XML | 单位 | 图元 | 文字 | 属性文字（源无 String） | 告警数 |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...results.map(entry => `| ${entry.file} | ${entry.units || '-'} | ${entry.primitives ?? '失败'} | ${entry.textPrimitives ?? '-'} | ${entry.dependentTextWithoutString ?? '-'} | ${entry.warnings?.length ?? entry.error} |`), '',
    '每个文件的完整告警、坐标范围及检查统计见 [corpus-audit.json](./corpus-audit.json)。', '',
  ].join('\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditCorpus(process.argv[2] ? resolve(process.argv[2]) : defaultCorpus)
  const output = process.argv[3] ? resolve(process.argv[3]) : fileURLToPath(new URL('../docs/corpus-audit.json', import.meta.url))
  mkdirSync(resolve(output, '..'), { recursive: true })
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
  writeFileSync(output.replace(/\.json$/i, '') + '.md', markdownReport(report))
  console.log(JSON.stringify(report.summary, null, 2))
  for (const entry of report.results.filter(entry => entry.status === 'error' || !entry.primitives)) {
    console.log(`${entry.file}: ${entry.error || 'no geometry'}`)
  }
  if (report.summary.failed || report.summary.invalidGeometry || report.summary.unexpectedZeroGeometry || report.summary.filesWithChangedDirectTextHeights) process.exitCode = 1
}
