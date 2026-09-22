import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { parseDexpi } from '../src/lib/dexpi-parser.js'
import { createSelectionNodes, primitiveSelectionId } from '../src/lib/primitive-selection.js'
import { DiagramRenderer } from '../src/lib/diagram-renderer.js'

const { window } = new JSDOM()
globalThis.DOMParser = window.DOMParser
globalThis.XMLSerializer = window.XMLSerializer

const position = (x, y) => `<Position><Location X="${x}" Y="${y}"/></Position>`
const byXmlId = (model, xmlId) => {
  const node = model.nodes.find(candidate => candidate.xmlId === xmlId && !candidate.isCatalogue)
  assert.ok(node, `Expected instance ${xmlId}`)
  return node
}
const ancestorsOf = (nodes, id) => {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const ancestors = []
  for (let node = byId.get(id); node; node = byId.get(node.parentId)) ancestors.push(node.id)
  return ancestors
}
const rendererFor = (model, nodes = createSelectionNodes(model)) => {
  const children = new Map(nodes.map(node => [node.id, node.childIds]))
  const objects = model.primitives.map(primitive => ({
    visible: true,
    userData: {
      selectionId: primitiveSelectionId(primitive),
      nodeId: primitive.nodeId,
      primitive,
    },
  }))
  return Object.assign(Object.create(DiagramRenderer.prototype), { children, objects })
}
const nestedCatalogueModel = () => parseDexpi(`<PlantModel>
  <ShapeCatalogue>
    <Label ID="cell-definition" ComponentName="cell">
      <Line ID="cell-line"><Coordinate X="0" Y="0"/><Coordinate X="4" Y="0"/></Line>
      <Text ID="cell-text" String="Design pressure" Height="2">${position(0, 2)}</Text>
    </Label>
    <Label ID="bar-definition" ComponentName="equipment-bar">
      <Label ComponentName="cell">${position(0, 0)}</Label>
      <Label ComponentName="cell">${position(12, 0)}</Label>
    </Label>
  </ShapeCatalogue>
  <Equipment ID="first" TagName="E-1">
    <Label ID="first-bar" ComponentClass="EquipmentBarLabel" ComponentName="equipment-bar">${position(10, 10)}</Label>
  </Equipment>
  <Equipment ID="second" TagName="E-2">
    <Label ID="second-bar" ComponentClass="EquipmentBarLabel" ComponentName="equipment-bar">${position(60, 10)}</Label>
  </Equipment>
</PlantModel>`)

test('H1007 tag and table text keep their own XML leaves and complete table ancestry', () => {
  const model = parseDexpi(readFileSync(new URL('../public/samples/C01V04-VER.EX01.xml', import.meta.url), 'utf8'))
  const nodes = createSelectionNodes(model)
  const byId = new Map(nodes.map(node => [node.id, node]))
  const equipment = byXmlId(model, 'PlateHeatExchanger-1')
  const tag = byXmlId(model, 'EquipmentTagNameLabel-1')
  const table = byXmlId(model, 'EquipmentBarLabel-1')
  const labels = model.primitives.filter(primitive => primitive.type === 'text' && primitive.text === 'H1007')
  const tagText = labels.find(primitive => ancestorsOf(model.nodes, primitive.sourceNodeId).includes(tag.id))
  const tableText = labels.find(primitive => ancestorsOf(model.nodes, primitive.sourceNodeId).includes(table.id))
  assert.ok(tagText)
  assert.ok(tableText)
  assert.notEqual(primitiveSelectionId(tagText), primitiveSelectionId(tableText))

  const renderer = rendererFor(model, nodes)
  for (const [primitive, label] of [[tagText, tag], [tableText, table]]) {
    const id = primitiveSelectionId(primitive)
    assert.equal(primitive.isCatalogueGeometry, false)
    assert.equal(id, primitive.sourceNodeId)
    assert.equal(byId.get(id), model.nodes.find(node => node.id === id))
    assert.equal(byId.get(id).tag, 'Text')
    assert.ok(ancestorsOf(nodes, id).includes(label.id))
    assert.ok(ancestorsOf(nodes, id).includes(equipment.id))
    const selected = renderer.objectsForSelection(id)
    assert.equal(selected.length, 1)
    assert.equal(selected[0].userData.primitive, primitive)
    assert.deepEqual(renderer.objectsForSelection(id), selected, 'Selecting the tree leaf again keeps the same drawable')
  }
  assert.equal(byId.get(table.id).parentId, equipment.id)
  assert.ok(byId.get(equipment.id).childIds.includes(table.id))
  assert.ok(renderer.objectsForSelection(table.id).length > 1, 'Selecting the table parent still selects its child geometry')
})

test('nested repeated catalogue symbols have unique occurrence leaves under the correct instance', () => {
  const model = nestedCatalogueModel()
  assert.deepEqual(model.warnings, [])
  const nodes = createSelectionNodes(model)
  const byId = new Map(nodes.map(node => [node.id, node]))
  const firstBar = byXmlId(model, 'first-bar')
  const secondBar = byXmlId(model, 'second-bar')
  assert.equal(model.primitives.length, 8)
  const selectionIds = model.primitives.map(primitiveSelectionId)
  assert.equal(new Set(selectionIds).size, 8)
  assert.equal(new Set(model.primitives.map(primitive => primitive.sourceNodeId)).size, 2)

  for (const instance of [firstBar, secondBar]) {
    const occurrences = model.primitives.filter(primitive => primitive.instanceNodeId === instance.id)
    assert.equal(occurrences.length, 4)
    assert.equal(new Set(occurrences.map(primitive => primitive.sourceNodeId)).size, 2,
      'Each source is repeated twice inside one instance, so source and instance together are insufficient')
    for (const primitive of occurrences) {
      const id = primitiveSelectionId(primitive)
      const leaf = byId.get(id)
      assert.ok(primitive.isCatalogueGeometry)
      assert.equal(leaf.parentId, instance.id)
      assert.equal(leaf.primitiveId, primitive.id)
      assert.equal(leaf.sourceNodeId, primitive.sourceNodeId)
      assert.equal(leaf.semanticId, instance.parentId)
      assert.equal(leaf.isPrimitiveInstance, true)
      assert.equal(leaf.isCatalogue, false)
      assert.ok(byId.get(instance.id).childIds.includes(id))
      assert.ok(model.getNodeXml(leaf.sourceNodeId), 'The original XML remains available for the occurrence inspector')
    }
  }
})

test('adding selection leaves preserves the original XML node arrays, child lists and statistics', () => {
  const model = nestedCatalogueModel()
  const originalNodes = model.nodes
  const nodeSnapshot = JSON.stringify(model.nodes)
  const statsSnapshot = { ...model.stats }
  for (const node of model.nodes) Object.freeze(node.childIds)
  Object.freeze(model.nodes)

  const nodes = createSelectionNodes(model)
  assert.equal(model.nodes, originalNodes)
  assert.equal(JSON.stringify(model.nodes), nodeSnapshot)
  assert.deepEqual(model.stats, statsSnapshot)
  assert.equal(model.stats.nodeCount, model.nodes.length)
  assert.equal(nodes.length, model.nodes.length + model.primitives.length)
  assert.equal(nodes.filter(node => node.isPrimitiveInstance).length, model.primitives.length)
  for (const xmlId of ['first-bar', 'second-bar']) {
    const original = byXmlId(model, xmlId)
    const selectable = nodes.find(node => node.id === original.id)
    assert.notEqual(selectable, original)
    assert.notEqual(selectable.childIds, original.childIds)
    assert.deepEqual(selectable.childIds.slice(0, original.childIds.length), original.childIds)
  }
})

test('renderer isolates one catalogue occurrence while parent selections aggregate descendants', () => {
  const model = nestedCatalogueModel()
  const renderer = rendererFor(model)
  const first = byXmlId(model, 'first')
  const firstBar = byXmlId(model, 'first-bar')
  const second = byXmlId(model, 'second')
  const secondBar = byXmlId(model, 'second-bar')

  for (const object of renderer.objects) {
    const id = object.userData.selectionId
    assert.deepEqual(renderer.objectsForSelection(id), [object])
    object.visible = false
    assert.deepEqual(renderer.objectsForSelection(id), [], 'A hidden leaf must not fall back to its shared source or owner')
    object.visible = true
    assert.deepEqual(renderer.objectsForSelection(id), [object])
  }
  for (const [equipment, table] of [[first, firstBar], [second, secondBar]]) {
    const expected = renderer.objects.filter(object => object.userData.primitive.instanceNodeId === table.id)
    assert.equal(expected.length, 4)
    assert.deepEqual(renderer.objectsForSelection(table.id), expected)
    assert.deepEqual(renderer.objectsForSelection(equipment.id), expected)
  }
  assert.deepEqual(renderer.objectsForSelection(model.rootId), renderer.objects)
})
