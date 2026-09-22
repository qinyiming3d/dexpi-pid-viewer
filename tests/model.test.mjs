import test from 'node:test'
import assert from 'node:assert/strict'
import Vue from 'vue'
import { buildPidDocument } from '../src/model/pid-document-builder.js'
import { createTreeNodes, createTree, searchTree, visibleTreeRows } from '../src/ui/tree/tree-projector.js'
const node = (id, parentId, tag = 'Equipment') => ({ id, parentId, tag, label: id, xmlId: id, category: 'equipment', attributes: {}, properties: [], semanticId: 'root', childIds: [] })
const fixture = () => ({ rootId: 'root', nodes: [node('leaf', 'root', 'Text'), node('root', null, 'PlantModel')], primitives: [{ id: 'g1', nodeId: 'root', sourceNodeId: 'leaf', instanceNodeId: 'root', isCatalogueGeometry: true, type: 'polyline' }], connections: [{ from: 'root', to: 'leaf' }], warnings: [] })
test('builder keeps shared reactive info, separate ownership and unobserved payloads', () => {
  const parsed = fixture()
  const data = buildPidDocument(parsed)
  const vm = new Vue({ data: () => ({ worldInfo: data.worldInfo }) })
  assert.equal(vm.worldInfo, data.worldInfo)
  assert.equal(data.worldInfo[0], data.getInfo('root'))
  assert.equal(data.getChildren('root')[0], data.getInfo('leaf'))
  assert.equal(data.getOwner('leaf'), data.getNode('root'))
  assert.equal(data.getNode('leaf').semanticOwnerId, 'root')
  assert.ok(data.getInfo('leaf').__ob__)
  assert.equal(data.getNode('leaf').attributes.__ob__, undefined)
  assert.equal(data.getNode('root').__ob__, undefined)
  assert.equal(data.getGraphics('root')[0], data.graphicMap.get('g1'))
  assert.deepEqual(data.getNode('leaf').connectionIds, ['connection:0'])
  assert.deepEqual(parsed.nodes[1].childIds, [])
  assert.doesNotThrow(() => JSON.stringify(data.worldInfo))
})
test('builder rejects ambiguous or invalid structural references', () => {
  for (const nodes of [[node('a', null), node('a', null)], [node('a', 'missing')], [node('a', 'b'), node('b', 'a')]]) {
    assert.throws(() => buildPidDocument({ nodes }))
  }
})
test('tree projection keeps instance leaves out of domain and supports search and renaming', () => {
  const data = buildPidDocument(fixture())
  const byId = createTreeNodes(data)
  assert.ok(byId['primitive:g1'])
  assert.equal(data.getNode('primitive:g1'), null)
  assert.equal(data.nodeMap.size, 2)
  const tree = createTree(data, byId, 'xml')
  const matches = searchTree(tree, 'leaf')
  assert.ok(matches.has('root'))
  assert.ok(matches.has('leaf'))
  assert.equal(visibleTreeRows(tree, byId, matches, {}).length, 2)
  assert.equal(visibleTreeRows(tree, byId, null, {}, 1).length, 1)
  data.getInfo('leaf').name = 'renamed'
  assert.equal(byId.leaf.label, 'renamed')
  assert.ok(searchTree(tree, 'renamed').has('leaf'))
})

import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { parseDexpi } from '../src/lib/dexpi-parser.js'
import { createSelectionNodes } from '../src/lib/primitive-selection.js'
test('all bundled samples retain selection hierarchy and shared domain references', () => {
  globalThis.DOMParser = new JSDOM().window.DOMParser
  const samples = new URL('../public/samples/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', samples), 'utf8'))
  for (const sample of manifest) {
    const parsed = parseDexpi(readFileSync(new URL(sample.file, samples), 'utf8'))
    const data = buildPidDocument(parsed)
    const projected = createTreeNodes(data)
    for (const legacy of createSelectionNodes(parsed)) {
      const view = projected[legacy.id]
      for (const key of ['label', 'tag', 'parentId', 'category', 'childIds']) assert.deepEqual(view[key], legacy[key])
    }
    for (const { info } of data.nodeMap.values()) {
      for (const child of info.children) {
        assert.equal(child, data.getInfo(child.id))
        assert.equal(child.ownerId, info.id)
      }
    }
    assert.equal(data.nodeMap.size, parsed.nodes.length)
    assert.equal(data.graphicMap.size, parsed.primitives.length)
  }
})
