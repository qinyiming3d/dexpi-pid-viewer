# DEXPI P&ID Viewer 项目说明

## 1. 项目简介

`dexpi-pid-viewer` 是一个基于 **Vue 2.7 + Vite + Three.js** 构建的前端 P&ID（Piping & Instrumentation Diagram）查看器。

项目主要目标是：

- 在浏览器本地读取 DEXPI / Proteus XML 文件；
- 解析 XML 中的设备、管道、仪表、属性、连接关系和图形数据；
- 将解析后的图形转换为 Three.js 场景并进行 2D 正交投影显示；
- 提供模型树、属性面板、搜索、图层控制、对象定位和导出功能；
- 支持内置示例 XML 和本地 XML 文件；
- 尽量保持原始工程数据和图形坐标，不对数据进行推测性修改。

当前实现重点支持 **Proteus XML / DEXPI 1.x 风格文件**。

对于 DEXPI 2.0 原生 `Model` XML，目前可以读取节点层级和属性，但暂不支持完整图形映射。

---

## 2. 技术栈

项目当前主要依赖如下：

| 技术 | 版本 | 用途 |
| --- | --- | --- |
| Vue | 2.7.16 | 页面 UI、状态管理、模型树、属性面板 |
| Vite | 5.4.21 | 本地开发服务器和构建 |
| @vitejs/plugin-vue2 | 2.3.4 | Vue 2 单文件组件支持 |
| Three.js | 0.180.0 | P&ID 图形渲染 |
| jsdom | 26.1.0 | Node 环境中的 DOM / XML 测试 |
| Playwright | 1.55.1 | 浏览器端 E2E 测试 |

项目没有后端服务。

XML 文件解析、图形生成和交互全部在浏览器本地完成。

---

## 3. 项目目录结构

```text
dexpi-pid-viewer/
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── playwright.config.js
│
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── style.css
│   │
│   ├── components/
│   │   └── AppIcon.vue
│   │
│   └── lib/
│       ├── dexpi-parser.js
│       └── diagram-renderer.js
│
├── public/
│   ├── favicon.svg
│   │
│   ├── icons/
│   │   └── *.svg
│   │
│   └── samples/
│       ├── manifest.json
│       ├── C01V04-VER.EX01.xml
│       └── C03V01-AVV.EX01.xml
│
├── tests/
│   ├── parser.test.mjs
│   ├── renderer.test.mjs
│   ├── corpus.test.mjs
│   └── viewer.spec.mjs
│
├── scripts/
│   ├── audit-corpus.mjs
│   ├── download-icons.mjs
│   ├── download-samples.mjs
│   └── visual-review.mjs
│
├── docs/
│   ├── data-sources.md
│   ├── corpus-audit.md
│   ├── corpus-audit.json
│   ├── viewer-screenshot.png
│   └── visual-review/
│
└── corpus-audit-before.json
```

---

# 4. 代码入口

## 4.1 `src/main.js`

前端应用入口。

主要职责：

```js
import Vue from "vue";
import App from "./App.vue";
import "./style.css";

Vue.config.productionTip = false;

new Vue({
  render: (h) => h(App),
}).$mount("#app");
```

整个程序从这里创建 Vue 实例，并挂载 `App.vue`。

调用关系：

```text
index.html
   ↓
src/main.js
   ↓
App.vue
```

---

# 5. `App.vue`

`App.vue` 是整个应用的 UI 和状态控制中心。

它不负责具体的 DEXPI 几何算法，而是负责连接：

```text
用户输入
  ↓
DEXPI Parser
  ↓
Three.js Renderer
  ↓
UI
```

主要职责包括：

- 初始化 Three.js Renderer；
- 加载示例文件列表；
- 默认打开第一个示例 XML；
- 本地 XML 文件导入；
- 拖拽 XML；
- 调用 `parseDexpi()`；
- 保存解析结果；
- 管理模型树；
- 管理对象选择状态；
- 管理属性面板；
- 管理图层；
- 搜索节点；
- 控制缩放和定位；
- PNG / JSON / XML 导出；
- 显示解析 warning；
- 快捷键处理。

---

## 5.1 App 启动流程

Vue 组件加载后执行：

```js
async mounted()
```

主要流程：

```text
App.vue mounted
       │
       ├── 创建 DiagramRenderer
       │
       ├── 监听全局快捷键
       │
       ├── fetch("/samples/manifest.json")
       │
       └── loadSample(samples[0])
```

默认情况下项目会自动加载第一个示例：

```text
C01V04-VER.EX01.xml
```

---

# 6. XML 加载流程

XML 有三种入口。

## 6.1 内置示例

```text
public/samples/manifest.json
           ↓
loadSample()
           ↓
fetch XML
           ↓
applyXml()
```

---

## 6.2 文件选择

用户点击：

```text
导入 XML
```

调用：

```text
onFileChange()
     ↓
readFile()
     ↓
applyXml()
```

---

## 6.3 拖拽导入

```text
drop event
    ↓
onDrop()
    ↓
readFile()
    ↓
applyXml()
```

---

# 7. `readFile()`

`App.vue` 中的：

```js
async readFile(file)
```

负责读取本地 XML。

处理流程：

```text
File
 │
 ├── 文件大小检查
 │
 ├── arrayBuffer()
 │
 ├── TextDecoder("utf-8")
 │
 ├── 检测 XML encoding
 │
 └── applyXml()
```

目前最大文件限制：

```text
30 MB
```

---

# 8. `applyXml()`

这是 UI 层进入 Parser 的核心入口。

```js
async applyXml(xml, fileName, sample = null)
```

流程：

```text
XML String
    ↓
parseDexpi()
    ↓
Parsed Model
    ↓
Object.freeze()
    ↓
nodeMap
    ↓
renderer.setModel()
```

解析后的 Model 会被冻结：

```js
this.model = Object.freeze(parsed)
```

这是为了防止 Vue 2 对几千甚至几万个节点进行深度响应式监听。

否则大型 XML 会带来明显性能问题。

---

# 9. DEXPI Parser

文件：

```text
src/lib/dexpi-parser.js
```

这是项目最重要的业务模块。

入口函数：

```js
parseDexpi(xml, options)
```

作用：

```text
DEXPI / Proteus XML
        ↓
内部统一数据模型
```

输出结构：

```js
{
  name,
  fileName,
  version,
  schemaVersion,
  format,
  units,

  rootId,

  nodes,
  primitives,
  connections,

  bounds,
  stats,
  warnings,

  getNodeXml()
}
```

---

# 10. Parser 总体流程

```text
XML String
   │
   ▼
安全检查
   │
   ▼
DOMParser
   │
   ▼
检查 Root
   │
   ├── PlantModel
   │
   └── DEXPI Model
   │
   ▼
建立完整 XML Node Tree
   │
   ▼
建立 ID 索引
   │
   ▼
建立 ShapeCatalogue
   │
   ▼
解析工程属性
   │
   ▼
解析几何图元
   │
   ▼
展开符号库实例
   │
   ▼
解析连接关系
   │
   ▼
计算 Bounds
   │
   ▼
统计 Stats
   │
   ▼
返回 Model
```

---

# 11. XML 安全检查

Parser 在真正解析前会检查：

```text
空 XML
文件大小
DOCTYPE
ENTITY
XML 语法
Root 节点
最大节点数量
最大 XML 嵌套深度
```

主要是防止：

- 错误 XML；
- XXE 类风险；
- 极端 XML 导致浏览器卡死。

例如：

```js
if (/<!DOCTYPE|<!ENTITY/i.test(xml))
```

会直接拒绝带有 DTD / ENTITY 的 XML。

---

# 12. Node Tree

Parser 会把整个 XML DOM 转换为统一 Node：

```js
{
  id,
  xmlId,
  tag,
  label,
  category,

  parentId,
  childIds,

  attributes,
  properties,
  text,

  isCatalogue,
  isSemantic,
  semanticId
}
```

其中：

### `id`

程序内部 ID：

```text
n0
n1
n2
...
```

### `xmlId`

原始 XML：

```xml
ID="CentrifugalPump-1"
```

对应：

```js
xmlId: "CentrifugalPump-1"
```

---

# 13. 节点分类

Parser 会把 XML 对象分为几个主要类别：

```text
equipment
piping
instrumentation
drawing
metadata
other
```

例如：

```text
Equipment
Nozzle
EquipmentComponent
```

属于：

```text
equipment
```

而：

```text
PipingNetworkSystem
PipingNetworkSegment
PipingComponent
```

属于：

```text
piping
```

这些分类之后会直接影响：

- 模型树；
- 图层控制；
- 图形颜色；
- 统计信息。

---

# 14. GenericAttributes

DEXPI 工程属性主要通过：

```xml
<GenericAttributes>
    <GenericAttribute />
</GenericAttributes>
```

读取。

Parser 会统一转成：

```js
{
  name,
  value,
  unit,
  source,
  format,
  language,
  uri
}
```

最终在右侧对象 Inspector 中展示。

---

# 15. ShapeCatalogue

DEXPI / Proteus 中大量设备符号并不是直接放在设备节点里。

通常结构类似：

```text
ShapeCatalogue
     │
     └── Pump Shape Definition
```

设备实例：

```text
Equipment
ComponentName="PumpShape"
```

Parser 会先建立：

```js
catalogue = new Map()
```

然后通过：

```text
ComponentName
```

找到对应 Shape。

---

# 16. ShapeCatalogue 变换

符号实例需要进行坐标变换：

```text
Catalogue Geometry
       ↓
Position
       ↓
Rotation
       ↓
Scale
       ↓
Final Geometry
```

内部使用二维仿射矩阵：

```text
[a c tx]
[b d ty]
[0 0  1]
```

主要函数：

```js
matrixOf()
multiply()
inverse()
transform()
```

---

# 17. 图形 Primitive

最终渲染并不直接使用 XML 节点。

Parser 会先生成统一 Primitive。

主要支持：

```text
PolyLine
Polyline
Line
CenterLine
Shape
Polygon
Circle
Ellipse
TrimmedCurve
Text
```

例如一条线：

```js
{
  id: "p12",
  nodeId: "n345",

  type: "polyline",

  points: [
    { x: 10, y: 20 },
    { x: 20, y: 20 }
  ],

  color,
  lineWeight,
  lineType,
  layer
}
```

---

# 18. Text 解析

文字处理除了直接：

```xml
<Text String="P-101" />
```

之外，还支持依赖属性：

```text
DependantAttribute
ItemID
ObjectAttributesReference
```

也就是说文字可以从设备属性动态生成。

例如：

```text
[Prefix]-[Sequence]
```

可以解析为：

```text
P-101
```

---

# 19. Connection

Parser 会读取：

```xml
<Connection
    FromID="..."
    ToID="..."
/>
```

统一生成：

```js
{
  id,
  nodeId,

  from,
  to,

  fromXmlId,
  toXmlId,

  fromNode,
  toNode,

  attributes
}
```

这部分数据主要用于：

```text
对象 Inspector
→ Connections
```

---

# 20. Bounds

所有图形解析完成后，会计算整体范围：

```js
{
  minX,
  minY,
  maxX,
  maxY
}
```

主要用于：

```text
Fit View
Camera Center
Zoom
Grid
```

---

# 21. Stats

Parser 会生成基础统计：

```js
stats: {
  nodeCount,
  equipment,
  piping,
  instrumentation,
  connections,
  primitives
}
```

UI 底部状态栏和 Overview 都依赖这些值。

---

# 22. Warnings

Parser 不会因为所有不支持的数据都直接中止。

一些问题会记录为：

```js
warnings[]
```

例如：

```text
重复 XML ID
缺失 ShapeCatalogue
未解析 Connection ID
未知引用
没有 Position
没有绘图坐标
不支持的图形类型
```

这种设计使 Viewer 可以：

```text
部分解析
+
继续浏览工程属性
```

---

# 23. 当前不完整支持的图形

当前 Parser 对以下类型仅 warning 或降级处理：

```text
BSpline
BezierCurve
NurbsCurve
RasterImage
Image
Hatch Fill
SlantAngle
```

如果 XML 中大量使用这些类型，可能出现：

```text
节点存在
属性存在
但图形显示缺失
```

这类问题应优先检查：

```text
dexpi-parser.js
```

而不是 Renderer。

---

# 24. DEXPI 2.0

如果 Root 为：

```xml
<Model xmlns="https://dexpi.org/schema">
```

项目会识别为：

```text
DEXPI XML
```

目前支持：

```text
Node hierarchy
Attributes
```

暂时不支持：

```text
DEXPI 2.0 graphical mapping
```

因此：

```text
模型树正常
画布为空
```

可能是当前设计限制，而不是运行错误。

---

# 25. Diagram Renderer

文件：

```text
src/lib/diagram-renderer.js
```

类：

```js
DiagramRenderer
```

职责：

```text
Parsed Model
    ↓
Three.js Objects
    ↓
Scene
    ↓
OrthographicCamera
    ↓
WebGL Canvas
```

---

# 26. Renderer 核心结构

主要 Three.js 对象：

```text
Scene
 │
 ├── grid
 │
 ├── diagram
 │
 └── selection
```

Camera：

```text
OrthographicCamera
```

P&ID 属于二维工程图，因此使用正交相机，而不是 PerspectiveCamera。

---

# 27. Primitive → Three.js

Renderer 根据 Primitive 类型创建对应 Three.js Object。

```text
polyline
   ↓
Line2

polygon
   ↓
ShapeGeometry + Mesh

text
   ↓
CanvasTexture + Mesh
```

---

# 28. 线宽

普通 WebGL Line 通常只能稳定显示约 1px 线宽。

项目使用：

```text
three/addons/lines/Line2.js
```

配合：

```text
LineGeometry
LineMaterial
```

支持工程图真实线宽。

---

# 29. Text Renderer

文字采用：

```text
Canvas
   ↓
CanvasTexture
   ↓
Three.js Mesh
```

并缓存：

```js
textCache
```

避免相同文字重复创建 Texture。

---

# 30. Camera

Renderer 保存：

```js
center
scale
fitScale
```

主要操作：

```text
fit()
focus()
zoomBy()
wheel()
pointer drag
```

---

# 31. Selection

选择对象后：

```text
Node ID
   ↓
descendantIds()
   ↓
查找该节点对应所有图形
   ↓
生成高亮副本
   ↓
绘制 Selection Box
```

所以选择一个 Equipment 时，可以高亮其所有子图元。

---

# 32. Hit Test

用户点击 Canvas：

```text
pointer event
     ↓
hitTest()
     ↓
找到 primitive
     ↓
nodeId
     ↓
App.vue selectNode()
```

最终实现：

```text
Canvas
Model Tree
Inspector
```

三者同步。

---

# 33. 图层

UI 图层：

```text
equipment
piping
instrumentation
drawing
metadata
other
```

Renderer 会根据：

```js
this.layers
```

设置 Object：

```js
visible
```

---

# 34. PNG 导出

Renderer：

```js
exportPng()
```

流程：

```text
Three Renderer
      ↓
WebGL Canvas
      ↓
新的 2D Canvas
      ↓
填充浅色背景
      ↓
drawImage()
      ↓
PNG Data URL
```

---

# 35. Model Tree

模型树全部由 `App.vue` 生成。

有两个模式：

```text
结构模型
XML 节点树
```

结构模型会隐藏大量纯绘图节点，只显示更有工程意义的节点。

XML 模式则接近完整 XML DOM。

---

# 36. 搜索

搜索字段会匹配：

```text
label
xmlId
tag
attributes
```

并自动保留父级路径。

因此用户搜索：

```text
P4711
```

时可以直接定位 Pump。

---

# 37. Inspector

右侧 Inspector 分为：

```text
属性
XML
连接
```

### 属性

显示：

```text
XML attributes
GenericAttributes
Text
Parent
Child Count
Node Path
```

### XML

通过：

```js
model.getNodeXml()
```

展示原始节点 XML。

### Connections

使用：

```js
model.connections
```

查找当前对象的 From / To 关系。

---

# 38. 导出功能

目前支持：

```text
JSON
PNG
XML
```

### JSON

导出解析后的：

```text
nodes
primitives
connections
bounds
stats
warnings
```

### PNG

导出当前 Canvas。

### XML

下载原始导入文件。

---

# 39. Tests

项目测试分成四层。

---

## 39.1 `parser.test.mjs`

测试：

```text
XML Parsing
ShapeCatalogue
Transform
Text
Connection
Bounds
Units
Invalid XML
DEXPI 2.0
```

这是 Parser 修改后最应该先跑的测试。

---

## 39.2 `renderer.test.mjs`

测试：

```text
Camera Fit
Line Weight
Dash Line
Closed Shape
Text Size
Text Font
Unit Scaling
```

主要针对：

```text
diagram-renderer.js
```

---

## 39.3 `corpus.test.mjs`

用于大规模 DEXPI 数据集回归。

支持通过：

```text
DEXPI_CORPUS
```

指定外部 TrainingTestCases。

它的目的不是只测几个 XML，而是检查：

```text
大量真实 DEXPI 文件
```

是否都能安全解析。

---

## 39.4 `viewer.spec.mjs`

Playwright E2E。

测试完整浏览器流程：

```text
启动页面
↓
加载 Sample
↓
搜索节点
↓
选择对象
↓
Inspector
↓
Canvas Picking
↓
Zoom
↓
Layer
↓
Export
↓
本地 XML Import
```

---

# 40. 内置 Sample 基准

当前测试中最重要的两个基准文件：

## C01

```text
C01V04-VER.EX01.xml
```

预期：

```text
5216 Nodes
564 Primitives
29 Connections
```

---

## C03

```text
C03V01-AVV.EX01.xml
```

预期：

```text
4413 Nodes
324 Primitives
```

这些数据非常适合作为回归测试指标。

---

# 41. Bug 排查建议

以后遇到问题不要直接从 `App.vue` 开始改。

建议沿数据流排查。

---

## 情况 1

```text
Node 数量不对
```

检查：

```text
dexpi-parser.js
```

重点：

```text
DOM traversal
namespace
XML node filtering
```

---

## 情况 2

```text
Node 正确
Primitive 数量错误
```

检查：

```text
Geometry Parser
ShapeCatalogue
Transform
Text
Curve
```

---

## 情况 3

```text
Nodes 正确
Primitives 正确
但画布显示错误
```

优先检查：

```text
diagram-renderer.js
```

重点：

```text
Camera
Bounds
Line2
Scale
Material
Text
Object visibility
```

---

## 情况 4

```text
Canvas 正常
但点击对象错误
```

检查：

```text
hitTest
nodeId
semanticId
descendantIds
nodeBounds
```

---

## 情况 5

```text
Canvas 和 Parser 都正确
但 UI 不对
```

检查：

```text
App.vue
```

重点：

```text
selectedId
treeData
visibleRows
layers
computed properties
```

---

# 42. 推荐调试顺序

```text
npm test
   ↓
Parser Tests
   ↓
Renderer Tests
   ↓
打开 C01
   ↓
确认 5216 / 564 / 29
   ↓
运行 npm run test:e2e
```

判断逻辑：

```text
节点错误
→ Parser

图元错误
→ Parser Geometry

数据正确但画错
→ Renderer

画布正确但 UI 错
→ App.vue
```

---

# 43. 当前值得注意的潜在问题

## 43.1 资源路径

当前代码存在：

```js
fetch("/samples/manifest.json")
```

以及：

```html
<img src="/favicon.svg">
```

如果以后部署到 GitHub Pages：

```text
/qinyiming3d/dexpi-pid-viewer/
```

这类绝对路径可能访问错误。

推荐改为：

```js
import.meta.env.BASE_URL
```

统一处理静态资源路径。

---

## 43.2 Playwright Edge 依赖

当前：

```js
channel: "msedge"
```

意味着 E2E 默认要求机器存在 Microsoft Edge。

在 CI / Linux / Docker 环境中可能导致：

```text
Browser not found
```

如果没有必须使用 Edge 的需求，可以直接使用 Playwright Chromium。

---

# 44. 项目核心架构总结

整个项目可以简化为：

```text
              ┌─────────────────┐
              │  DEXPI / XML    │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ dexpi-parser.js │
              └────────┬────────┘
                       │
                       ▼
       ┌───────────────────────────────┐
       │ Parsed Model                  │
       │                               │
       │ nodes                         │
       │ primitives                    │
       │ connections                   │
       │ bounds                        │
       │ stats                         │
       │ warnings                      │
       └───────────────┬───────────────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
        ┌───────────┐     ┌───────────────────┐
        │ App.vue   │     │ diagram-renderer  │
        │           │     │ .js               │
        │ Tree      │     │                   │
        │ Inspector │     │ Three.js          │
        │ Search    │     │ WebGL             │
        └─────┬─────┘     └─────────┬─────────┘
              │                     │
              └──────────┬──────────┘
                         │
                         ▼
                 ┌──────────────┐
                 │  P&ID Viewer │
                 └──────────────┘
```

---

# 45. 最重要的代码边界

后续开发建议始终保持以下边界：

```text
App.vue
只负责 UI / State
```

```text
dexpi-parser.js
只负责 XML → Model
```

```text
diagram-renderer.js
只负责 Model → Canvas
```

避免：

```text
Parser 操作 Vue
Renderer 读取 XML
App.vue 实现复杂 DEXPI 几何算法
```

否则项目后面会越来越难调试。

---

# 46. 开发命令

安装：

```bash
npm ci
```

本地启动：

```bash
npm run dev
```

地址：

```text
http://127.0.0.1:5178
```

构建：

```bash
npm run build
```

单元测试：

```bash
npm test
```

E2E：

```bash
npm run test:e2e
```

Corpus Audit：

```bash
npm run audit:corpus
```

---

# 47. 推荐后续改进方向

后续建议优先处理：

1. 为 Parser / Renderer 增加更明确的 TypeScript 数据类型；
2. 将 `App.vue` 继续拆分为：
   - ModelTree
   - Inspector
   - CanvasToolbar
   - StatusBar
   - SampleDialog
3. 给 DEXPI Parser 添加统一 Primitive Schema；
4. 为 unsupported geometry 增加专门测试；
5. 修复 GitHub Pages Base URL；
6. 降低 Playwright 对 Edge 的强依赖；
7. 增加 GitHub Actions；
8. 每个 bug 建立一个最小 XML Regression Test；
9. 逐步补齐 BSpline / Bezier / Nurbs；
10. 如果需要完整支持 DEXPI 2.0，应单独设计新的 graphical mapping 模块。

---

# 48. 一句话理解这个项目

```text
DEXPI XML
→ 解析成统一工程模型
→ 转换成 Three.js 图形
→ 使用 Vue 提供工程浏览与交互
```

项目最重要的两个核心文件是：

```text
src/lib/dexpi-parser.js
src/lib/diagram-renderer.js
```

以后大部分解析和显示 Bug 都可以通过这两个模块的输入输出边界快速定位。
