# 解析器模块与数据边界

## 入口

应用使用 `src/parser/parse-dexpi.js`：

```js
const {
  dto,
  sourceRepository,
} = parseDexpiSource(xml, {
  fileName,
})

const data = buildPidDocument(dto)
this.documentData = Object.freeze(data)
this.worldInfo = data.worldInfo
this.sourceRepository = Object.freeze(sourceRepository)
```

只需要工程数据时调用 `parseDexpi(xml, options)`，返回的 DTO 没有函数、DOM 节点或 Vue/Three 对象，可以 `structuredClone` 和 JSON 序列化。可选字段的 `undefined` 值遵循 JSON 的省略规则。

`src/lib/dexpi-parser.js` 仅是旧入口的兼容封装，保留 `getNodeXml(id)`。新功能应从 `src/parser/parse-dexpi.js` 导入。源码仓库由单次导入独立持有，避免同名内部节点 ID 在切换文件后指向错误文档。

## 职责划分

| 模块 | 职责 |
| --- | --- |
| `parse-dexpi.js` | 安排解析顺序、组装 DTO；不包含具体图形算法 |
| `xml/xml-reader.js` | 输入大小、声明、语法和根节点检查 |
| `xml/xml-utils.js` | 命名空间兼容属性读取、直接子节点和文本读取 |
| `xml/xml-source-repository.js` | Inspector 的原始 XML / Element 查询 |
| `proteus/node-parser.js` | XML 层级、节点 ID、语义归属及文档内引用索引 |
| `proteus/domain-tags.js` | 工程分类和图形标签规则 |
| `proteus/property-parser.js` | 通用属性、节点标签、被引用属性值 |
| `proteus/text-parser.js` | 显式文字、属性引用和模板文字 |
| `proteus/connection-parser.js` | 连接端点及未解析引用诊断 |
| `proteus/graphics-parser.js` | 图形遍历、图元 ID 与实例归属 |
| `proteus/geometry-parser.js` | 分别读取线、曲线和文字几何 |
| `proteus/catalogue-parser.js` | 定义索引、符号实例展开和循环检测 |
| `proteus/transform-reader.js` / `style-reader.js` | XML 中的变换和绘图样式 |
| `proteus/document-info.js` | 文档信息、单位默认值、声明范围和统计 |
| `graphics/` | 不依赖 XML、Vue 或 Three 的矩阵、采样和边界算法 |
| `diagnostics.js` | 单次解析内的告警去重，保持出现顺序 |

所有文档索引和告警集合都在单次解析内创建。子模块只接收实际需要的依赖，不读取应用状态，也不构建 UI 树。

## 扩展与兼容约束

- 增加图形类型：在 `geometry-parser.js` 增加读取函数，在图形标签集合登记；保持图元归属由 `graphics-parser.js` 分配。
- 增加属性规则：修改 `property-parser.js`，文字引用复用其属性读取规则。
- 调整曲线采样或边界：修改 `graphics/` 并使用不创建 XML 的几何测试验证。
- 符号库索引只登记定义和目录包装层，不将定义内部的引用再次登记为定义。实例保留外层 `instanceNodeId`，每次展开有独立图元 ID。
- 保持 `parentId` 与 `semanticId` 的不同含义、XML 顺序、绘图顺序和 warning 顺序。
- 保持现有 DTO 字段名（包含 `primitives`），渲染器与模型构造器可继续消费数据。
- `worldInfo` 直接交给 Vue `data` 观察，不在解析器或模型层调用 `Vue.observable`。
- 所有 `if` 和循环使用花括号；对象字段、变量声明分别换行。

当前实现仍依赖环境提供的 `DOMParser`，不直接声称能在浏览器 Worker 中运行；纯数据传输边界已建立。原生 DEXPI 2.0 的图形映射能力保持原状。Renderer 的业务树解耦是后续独立工作。

## 验证方法

`npm test` 覆盖解析、纯数据边界、源码隔离、几何核心、模型与渲染材料；`npm run test:e2e` 覆盖真实样例、树和源码联动、缩放、文字、遮挡、高亮及 PNG/JSON 导出。

本轮对 442 份 XML 做了重构前后 JSON SHA-256 对比，结果全部相同。另用嵌套重复符号的回归用例验证原有符号定义覆盖问题已修复。

Three.js 固定为 `0.153.0`，`package-lock.json` 同步更新。几何核心不依赖 Three.js，库版本变更只需要在渲染器边界验证。
