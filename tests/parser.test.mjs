import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'
import { parseDexpi } from '../src/lib/dexpi-parser.js'

const { window } = new JSDOM()
globalThis.DOMParser = window.DOMParser
globalThis.XMLSerializer = window.XMLSerializer
const samples = new URL('../public/samples/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', samples), 'utf8'))
const position = (x, y, rx = 1, ry = 0) => `<Position><Location X="${x}" Y="${y}"/><Reference X="${rx}" Y="${ry}"/></Position>`
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≠ ${expected}`)

test('downloaded files retain their upstream bytes and yield real geometry and complete hierarchy', () => {
  for (const sample of manifest) {
    const buffer = readFileSync(new URL(sample.file, samples))
    assert.equal(createHash('sha256').update(buffer).digest('hex'), sample.sha256)
    const xml = buffer.toString('utf8')
    const model = parseDexpi(xml, { fileName: sample.file })
    const document = new DOMParser().parseFromString(xml, 'application/xml')
    assert.equal(model.nodes.length, document.getElementsByTagName('*').length)
    assert.ok(model.nodes.length > 4000)
    assert.ok(model.primitives.length > 300)
    assert.ok(model.connections.length >= 10)
    assert.deepEqual(model.warnings, [])
    assert.equal(new Set(model.nodes.map(n => n.id)).size, model.nodes.length)
    const byId = new Map(model.nodes.map(n => [n.id, n]))
    for (const node of model.nodes) {
      if (node.parentId) assert.ok(byId.get(node.parentId).childIds.includes(node.id))
    }
    for (const primitive of model.primitives) {
      assert.ok(byId.has(primitive.nodeId))
      assert.ok(!byId.get(primitive.nodeId).isCatalogue)
      for (const point of primitive.points || [primitive.position]) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y))
    }
    assert.ok(model.nodes.some(n => n.label === 'P4711' && n.properties.length >= 8))
    assert.ok(/^<PlantModel[\s>]/.test(model.getNodeXml(model.rootId)))
    assert.equal(model.getNodeXml('unknown'), '')
  }
})

test('catalogue coordinates rotate, scale and translate; instance labels remain absolute', () => {
  const model = parseDexpi(`<PlantModel>
    <ShapeCatalogue><Equipment ID="def" ComponentName="pump">${position(1, 2)}<Line><Coordinate X="1" Y="2"/><Coordinate X="3" Y="2"/></Line></Equipment></ShapeCatalogue>
    <Equipment ID="pump-1" TagName="P-101" ComponentName="pump">${position(10, 20, 0, 1)}<Scale X="2" Y="3"/>
      <Label><Text String="P-101" Height="3">${position(30, 40)}</Text></Label>
      <GenericAttributes Set="DexpiAttributes"><GenericAttribute Name="DesignPressure" Value="6" Units="bar"/></GenericAttributes>
    </Equipment></PlantModel>`)
  const pump = model.nodes.find(n => n.xmlId === 'pump-1')
  assert.equal(model.stats.equipment, 1)
  assert.deepEqual(pump.properties[0], { name: 'DesignPressure', value: '6', unit: 'bar', source: 'DexpiAttributes', format: '', language: '', uri: '' })
  const line = model.primitives.find(p => p.type === 'polyline')
  near(line.points[0].x, 10); near(line.points[0].y, 20)
  near(line.points[1].x, 10); near(line.points[1].y, 24)
  assert.equal(line.isCatalogueGeometry, true)
  assert.equal(line.nodeId, pump.id)
  const text = model.primitives.find(p => p.type === 'text')
  assert.deepEqual(text.position, { x: 30, y: 40 })
  assert.equal(text.nodeId, pump.id)
  assert.equal(model.nodes.find(n => n.tag === 'GenericAttribute').parentId, model.nodes.find(n => n.tag === 'GenericAttributes').id)
})

test('namespace prefixes, connections, duplicate ids and unresolved references are preserved', () => {
  const model = parseDexpi(`<p:PlantModel xmlns:p="urn:proteus">
    <p:Equipment ID="a"/><p:Equipment ID="a"/><p:Equipment ID="b"/>
    <p:PipingNetworkSegment ID="s"><p:Connection FromID="a" ToID="b" FromNode="1" ToNode="2"/><p:Connection FromID="missing"/>
    <p:Association ItemID="ghost"/></p:PipingNetworkSegment></p:PlantModel>`)
  assert.equal(model.nodes.filter(n => n.xmlId === 'a').length, 2)
  assert.equal(model.connections[0].from, model.nodes.find(n => n.xmlId === 'a').id)
  assert.equal(model.connections[0].to, model.nodes.find(n => n.xmlId === 'b').id)
  assert.equal(model.connections[0].fromNode, '1')
  assert.equal(model.connections[1].from, null)
  assert.ok(model.warnings.some(w => w.includes('重复')))
  assert.ok(model.warnings.some(w => w.includes('missing')))
  assert.ok(model.warnings.some(w => w.includes('ghost')))
})

test('trimmed ellipse uses geometric polar angles and circles support solid fill', () => {
  const model = parseDexpi(`<PlantModel><Drawing><TrimmedCurve StartAngle="45" EndAngle="135"><Ellipse PrimaryAxis="10" SecondaryAxis="5">${position(0, 0)}</Ellipse></TrimmedCurve>
    <Circle Radius="2" Filled="Solid">${position(20, 10)}</Circle></Drawing></PlantModel>`)
  const arc = model.primitives[0]
  near(arc.points[0].x, Math.sqrt(20)); near(arc.points[0].y, Math.sqrt(20))
  near(arc.points.at(-1).x, -Math.sqrt(20)); near(arc.points.at(-1).y, Math.sqrt(20))
  assert.equal(arc.closed, false)
  assert.equal(model.primitives.length, 2)
  assert.equal(model.primitives[1].type, 'polygon')
})

test('missing geometry is reported without inventing a drawing', () => {
  const model = parseDexpi('<PlantModel><Equipment ID="pump" ComponentName="unknown"/><Drawing><Circle Radius="5"/><PolyLine/></Drawing></PlantModel>')
  assert.equal(model.primitives.length, 0)
  assert.ok(model.warnings.some(w => w.includes('unknown')))
  assert.ok(model.warnings.some(w => w.includes('未发现可绘制')))
})

test('text height and fallback sizes follow drawing units without a fixed minimum', () => {
  const model = parseDexpi(`<PlantModel><PlantInformation Units="m"/><Drawing>
    <Text String="DN150" Height="0.002">${position(0.2, 0.1)}</Text>
    <Text String="default">${position(0.2, 0.2)}</Text>
    <Text String="invalid" Height="0">${position(0.2, 0.3)}</Text>
    </Drawing></PlantModel>`)
  near(model.primitives[0].height, 0.002)
  near(model.primitives[0].lineWeight, 0.00025)
  near(model.primitives[1].height, 0.0025)
  assert.equal(model.primitives.length, 2)
  assert.ok(model.warnings.some(w => w.includes('Height')))
})

test('a line without a sheet extent keeps unit-invariant bounds on its degenerate axis', () => {
  const line = (units, length) => parseDexpi(`<PlantModel><PlantInformation Units="${units}"/>
    <Drawing><PolyLine><Coordinate X="0" Y="0"/><Coordinate X="${length}" Y="0"/></PolyLine></Drawing></PlantModel>`)
  const metres = line('m', 0.01), millimetres = line('mm', 10)
  near(metres.bounds.maxX * 1000, millimetres.bounds.maxX)
  near(metres.bounds.maxY * 1000, millimetres.bounds.maxY)
})

test('attribute-driven labels resolve object attributes, properties and ordered template fragments', () => {
  const model = parseDexpi(`<PlantModel><Equipment ID="tank" TagName="T-101">
    <GenericAttributes><GenericAttribute Name="Prefix" Value="T"/>
      <GenericAttribute Name="Sequence" Value="101"/>
      <GenericAttribute Name="Pressure" Value="0" Units="bar"/></GenericAttributes>
    <Label>
      <Text DependantAttribute="[Prefix]-[Sequence]" ItemID="tank">${position(0, 0)}</Text>
      <Text DependantAttribute="[TagName]">${position(0, 1)}</Text>
      <Text>${position(0, 2)}<TextStringFormatSpecification>
        <ObjectAttributesReference DependantAttribute="Pressure" ItemID="tank" DependantAttributeContents="Value"/>
        <ObjectAttributesReference DependantAttribute=" "/>
        <ObjectAttributesReference DependantAttribute="Pressure" ItemID="tank" DependantAttributeContents="Units"/>
      </TextStringFormatSpecification></Text>
      <Text String="explicit" DependantAttribute="[missing]" ItemID="ghost">${position(0, 3)}</Text>
    </Label></Equipment></PlantModel>`)
  assert.deepEqual(model.primitives.map(p => p.text), ['T-101', 'T-101', '0 bar', 'explicit'])
  assert.deepEqual(model.warnings, [])
})

test('unresolved attribute text is reported instead of fabricating a label', () => {
  const model = parseDexpi(`<PlantModel><Equipment ID="tank"><Label>
    <Text DependantAttribute="[missing]" ItemID="tank">${position(0, 0)}</Text>
    <Text DependantAttribute="[TagName]" ItemID="ghost">${position(0, 1)}</Text>
    </Label></Equipment></PlantModel>`)
  assert.equal(model.primitives.length, 0)
  assert.ok(model.warnings.some(w => w.includes('missing')))
  assert.ok(model.warnings.some(w => w.includes('ghost')))
})

test('plant structure component names are not mistaken for catalogue symbols', () => {
  const model = parseDexpi(`<PlantModel><PlantStructureItem ID="site" ComponentName="DEXPI" ComponentClass="ProcessPlant"/>
    <Drawing><Text String="sheet">${position(0, 0)}</Text></Drawing></PlantModel>`)
  assert.deepEqual(model.warnings, [])
})

test('native DEXPI Model exposes hierarchy and clearly reports unsupported native graphics', () => {
  const model = parseDexpi('<Model xmlns="https://dexpi.org/schema" name="demo"><Object id="a" type="Plant.Pump"/></Model>')
  assert.equal(model.format, 'DEXPI XML')
  assert.equal(model.nodes.length, 2)
  assert.equal(model.primitives.length, 0)
  assert.ok(model.warnings.some(w => w.includes('DEXPI 2.0')))
})

test('malformed XML, unrelated roots, DTDs and excessive nesting are rejected', () => {
  assert.equal(parseDexpi('\uFEFF<?xml version="1.0"?><PlantModel/>').nodes.length, 1)
  assert.throws(() => parseDexpi('<PlantModel><Equipment></PlantModel>'), /XML 语法错误/)
  assert.throws(() => parseDexpi('<html/>'), /不是受支持/)
  assert.throws(() => parseDexpi('<Model><Object/></Model>'), /不是受支持/)
  assert.throws(() => parseDexpi('<!DOCTYPE PlantModel [<!ENTITY xxe SYSTEM "file:///test">]><PlantModel/>'), /DOCTYPE/)
  assert.throws(() => parseDexpi(''), /为空/)
  assert.throws(() => parseDexpi('<PlantModel>' + '<a>'.repeat(257) + '</a>'.repeat(257) + '</PlantModel>'), /嵌套/)
})
