import Vue from 'vue'
import {JSDOM} from 'jsdom'
import {readFileSync} from 'node:fs'
import {parseDexpi} from '../src/lib/dexpi-parser.js'
import {buildPidDocument} from '../src/model/pid-document-builder.js'
import {createTreeNodes,createTree,visibleTreeRows} from '../src/ui/tree/tree-projector.js'
globalThis.DOMParser=new JSDOM().window.DOMParser
const parsed=parseDexpi(readFileSync('public/samples/C01V04-VER.EX01.xml','utf8'))
const data=Object.freeze(buildPidDocument(parsed))
const nodeMap=createTreeNodes(data), treeViews=Object.freeze({model:createTree(data,nodeMap)})
const vm=new Vue({data:()=>({documentData:data, worldInfo:data.worldInfo, nodeMap, treeViews, tick:0}),computed:{tree(){return this.treeViews.model},rows(){return visibleTreeRows(this.tree,this.nodeMap,null,{[parsed.rootId]:true})}}})
vm.$watch(function(){return [this.tick,this.rows.length,this.tree.entries.length]},()=>{}, {immediate:true})
const start=performance.now();for(let i=0;i<100;i++){vm.tick++;await Vue.nextTick()}
console.log(JSON.stringify({nodes:parsed.nodes.length,dependencies:Object.fromEntries(Object.entries(vm._computedWatchers).map(([k,w])=>[k,w.deps.length])),updates100Ms:performance.now()-start}))
vm.$destroy()
