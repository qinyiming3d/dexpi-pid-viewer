import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { parseDexpi, parseDexpiSource } from '../src/parser/parse-dexpi.js'
import { parseDexpi as parseLegacy } from '../src/lib/dexpi-parser.js'

const dom = new JSDOM()
globalThis.DOMParser = dom.window.DOMParser
globalThis.XMLSerializer = dom.window.XMLSerializer

const position = '<Position><Location X="10" Y="20"/></Position>'
const xml = `<PlantModel><Equipment ID="pump" TagName="P-101">
  <Label><Text String="P-101" Height="2">${position}</Text></Label>
  <Line><Coordinate X="0" Y="0"/><Coordinate X="10" Y="5"/></Line>
  <Connection FromID="pump" ToID="pump"/>
</Equipment></PlantModel>`

test('core parser returns cloneable data with no source access attached', () => {
  const dto = parseDexpi(xml)
  assert.deepEqual(structuredClone(dto), dto)
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(dto))), JSON.stringify(dto))
  assert.equal('getNodeXml' in dto, false)
  assert.equal('sourceRepository' in dto, false)
  assert.equal(dto.primitives.length, 2)
  assert.equal(dto.connections.length, 1)
})

test('source repositories retain the correct document when node IDs are reused', () => {
  const first = parseDexpiSource(xml)
  const second = parseDexpiSource('<PlantModel><Equipment ID="tank"/></PlantModel>')
  assert.equal(first.dto.rootId, second.dto.rootId)
  assert.deepEqual(first.dto, parseDexpi(xml))
  assert.match(first.sourceRepository.getXml('n1'), /ID="pump"/)
  assert.match(second.sourceRepository.getXml('n1'), /ID="tank"/)
  assert.equal(first.sourceRepository.getElement('n1').getAttribute('ID'), 'pump')
  assert.equal(first.sourceRepository.getXml('missing'), '')
  assert.equal(first.sourceRepository.getElement('missing'), null)
  assert.doesNotThrow(() => structuredClone(first.dto))
})

test('legacy entry preserves source inspection without changing serialized data', () => {
  const legacy = parseLegacy(xml)
  assert.equal(JSON.stringify(legacy), JSON.stringify(parseDexpi(xml)))
  assert.match(legacy.getNodeXml('n0'), /^<PlantModel/)
  assert.equal(legacy.getNodeXml('missing'), '')
})

test('pure-data entry retains native format warnings and input validation', () => {
  const native = parseDexpi('<Model xmlns="https://dexpi.org/schema"><Object id="a"/></Model>')
  assert.equal(native.format, 'DEXPI XML')
  assert.equal(native.nodes.length, 2)
  assert.equal(native.primitives.length, 0)
  assert.match(native.warnings[0], /DEXPI 2.0/)
  assert.throws(() => parseDexpi(''), /为空/)
  assert.throws(() => parseDexpi('<PlantModel>'), /XML 语法错误/)
  assert.throws(() => parseDexpi('<html/>'), /不是受支持/)
  assert.throws(() => parseDexpi('<!DOCTYPE PlantModel><PlantModel/>'), /DOCTYPE/)
})

test('catalogue wrappers and ID aliases resolve definitions without indexing nested references', () => {
  const dto = parseDexpi(`<PlantModel>
    <ShapeCatalogue><Group><Label ID="symbol" ComponentName="bar">
      <Line><Coordinate X="0" Y="0"/><Coordinate X="4" Y="0"/></Line>
    </Label></Group></ShapeCatalogue>
    <Equipment ID="e"><Label ComponentName="symbol">${position}</Label></Equipment>
  </PlantModel>`)
  assert.deepEqual(dto.warnings, [])
  assert.equal(dto.primitives.length, 1)
  assert.deepEqual(dto.primitives[0].points, [
    {
      x: 10,
      y: 20,
    },
    {
      x: 14,
      y: 20,
    },
  ])
})

test('cyclic catalogue references stop and deduplicate warnings', () => {
  const dto = parseDexpi(`<PlantModel><ShapeCatalogue>
    <Label ComponentName="cycle"><Label ComponentName="cycle">${position}</Label></Label>
  </ShapeCatalogue><Equipment ComponentName="cycle">${position}</Equipment></PlantModel>`)
  assert.equal(dto.primitives.length, 0)
  assert.equal(dto.warnings.filter((warning) => /循环/.test(warning)).length, 1)
})
