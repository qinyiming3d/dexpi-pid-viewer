# 数据边界重构：第一阶段

本轮按设计方案的渐进迁移顺序实施模型层及树投影迁移，尚未完成全部六个阶段。

## 当前数据流

`parseDexpi → buildPidDocument → PidDocumentData → TreeProjector → App.vue`

旧解析结果仍供 Renderer、XML 源码查看及兼容 JSON 导出使用。Parser 和 Renderer 的 API 本轮不变。

- `src/model/pid-document-data.js`：统一节点、图形、连接索引及查询 API。
- `src/model/node-info.js`：轻量结构信息；通过注入的 `reactive` 创建，不依赖 Vue。
- `src/model/pid-document-builder.js`：适配现有解析结果，验证节点唯一性、归属可解析性和无环性。完整构建普通对象后，将 worldInfo 赋给 Vue data，由 Vue 自动观察轻量 info 树；App 冻结模型外壳，避免深度观察载荷。
- `src/ui/tree/tree-projector.js`：工程树/XML 树投影、搜索祖先展开和有上限的迭代式行遍历。图元实例仅为 UI 记录，不写入正式 nodeMap。

`worldInfo`、`info.children` 与 `nodeMap.get(id).info` 共享对象引用。`info.ownerId` 表示直接父节点；`semanticOwnerId` 保留原解析器的工程归属。图形暂保留旧字段，同时增加 ownerId，后续迁移 RenderData 时再统一 geometry/style 协议。

## 验证

- 新增 `tests/model.test.mjs`：4 项通过；涵盖 Vue 观察边界、共享引用、异常归属、实例投影、搜索，以及全部内置样例的新旧选择记录对比。
- 原有单元测试：22 项通过，3 项失败；在 HEAD 临时副本运行 primitive-selection 测试复现相同失败，涉及嵌套重复符号库展开。
- 页面端到端：8 项通过，3 项失败；在 HEAD 临时副本复现相同断言失败：H1007 重叠图元命中、保留搜索词时的树标题断言、画布点击期望设备而实际选择图元实例。
- `npm run build` 成功；Three.js 分块仍有超过 500 kB 的构建提示。
- 基线副本未复制 dexpi_data，另外两个 SVG 测试因缺少资源失败，两个相关样例测试跳过；这些不作为回归比较依据。

## 后续阶段

先处理已有失败并明确重叠图元选择与树切换搜索的行为约定，再引入 RenderDataAdapter，删除 Renderer 的业务树重建；随后拆分 SourceRepository 和纯 DTO Parser，最后提取几何核心并删除兼容层。当前 Parser 仍返回 getNodeXml 闭包，不能声称已支持 structuredClone 或 Worker 传输。

## 滚动/缩放性能修复

移除 Vue.observable 及 Builder 的 reactive 注入参数。App.data 显式声明 worldInfo，并与 documentData.worldInfo 保持同一数组。节点属性、图形、连接仍不进入响应式系统。

原先 nodeMap → treeData → visibleRows 的 computed 链收集并转发近两万个节点依赖。即使 computed 缓存命中，页面更新仍有依赖转发成本。现在在导入时生成两个树模式的只读索引；名称显示和搜索仍读取响应式 info。结构索引是导入快照，未来若新增移动/插入节点编辑功能，需显式重建索引。

缩放读数拆为 ZoomControl，保持 view 对象引用稳定，只更新内部字段，使视口更新不再触发 App 整体重渲染。

默认 5,216 节点样例的 Vue 依赖微基准：100 次无关更新由约 259 ms 降至约 1.6 ms；不代表实际整页帧率。scripts/profile-tree.mjs 可复测当前版本。新增浏览器测试确认连续 10 次缩放触发 0 次 App 更新，worldInfo 共享引用及节点名称响应式生效，属性载荷未被观察。

修复验证：4 项模型测试、3 项定向浏览器测试和生产构建通过。
