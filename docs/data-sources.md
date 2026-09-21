# 数据来源与支持范围

下载日期：2026-09-21。两个 XML 均为从公开上游直接下载的原始文件，未用手写示意数据替代。固定提交和 SHA-256 保存在 `public/samples/manifest.json`；可运行 `node scripts/download-samples.mjs` 重现下载，内容不匹配时脚本不会覆盖已有文件。

## 示例 XML

| 本地文件 | 来源 | 说明 |
| --- | --- | --- |
| `C01V04-VER.EX01.xml` | [pyDEXPI 数据文件，固定提交](https://github.com/process-intelligence-research/pyDEXPI/blob/83e5a11c4af3635ad12290a4dbe310480eb6d7a3/data/C01V04-VER.EX01.xml) | DEXPI 官方参考 P&ID 的公开副本；445,726 字节；DEXPI 1.3.1 / Proteus 4.1.1。默认演示。 |
| `C03V01-AVV.EX01.xml` | [DEXPI 官方 TestCases 历史归档，固定提交](https://github.com/DEXPI/TestCases/blob/09e9eddcb9da510ca6c103a01816b2629e903745/tests/C03%20DEXPI%20Example%20Tank%20Displ%20Pump%20Pipe%20with%20Tee/C03V01-AVV.EX01.xml) | 储罐、泵和带三通管道的真实软件导出；274,114 字节。 |

上游 [pyDEXPI README](https://github.com/process-intelligence-research/pyDEXPI#using-pydexpi) 将 C01 参考图纸标明为 **© DEXPI e.V.**，并链接至 [DEXPI 官方参考文件目录](https://gitlab.com/dexpi/TrainingTestCases/-/tree/master/dexpi%201.3/example%20pids/C01%20DEXPI%20Reference%20P%26ID)。pyDEXPI 软件本身标注 AGPL-3.0；本项目没有复制、移植或依赖该软件代码，也不把软件许可当作这份第三方图纸的独立授权。

DEXPI/TestCases 归档没有提供独立的根目录 LICENSE 文件。本项目保留来源与版权说明，使用其公开测试数据作本地解析演示。公开可下载不等同于已确认可以在任意许可下重新分发；对外分发数据或商业发布时，应核对原权利人提供的数据许可。DEXPI 规范的 Creative Commons 许可也不自动覆盖各厂商提交的图纸。

## 解析器依据

- [DEXPI 官方规范入口](https://dexpi.org/specifications/)：区分 DEXPI 1.x 的 Proteus XML 与 DEXPI 2.0 原生 XML。
- [DEXPI 1.4 — Proteus 映射](https://dexpi.org/static/pid_specification_1.4/concepts/proteus.html)：ComponentClass、GenericAttributes 与引用关系。
- [DEXPI 1.4 — DexpiModel](https://dexpi.org/static/pid_specification_1.4/reference/DexpiModel/DexpiModel.html)：PlantModel / PlantInformation。
- [DEXPI 1.4 — Ellipse](https://dexpi.org/static/pid_specification_1.4/reference/Graphics/Ellipse.html) 与 [EllipseArc](https://dexpi.org/static/pid_specification_1.4/reference/Graphics/EllipseArc.html)：轴长、位置和弧段角度映射。
- [ProteusXML 4.0.1 Schema](https://github.com/ProteusXML/proteusxml/blob/master/ProteusPIDSchema%204.0.1.xsd)：图元元素及属性。
- [DEXPI GraphicBuilder](https://github.com/DEXPI/GraphicBuilder)：官方历史图形查看工具入口，仅用来确认格式背景，未复制实现。

## 实际能力

- 保留 XML 的全部元素、原始父子层级、属性、文本与原始 ID；内部唯一 ID 不会覆盖重复的 XML ID。
- 将 GenericAttribute 的值、单位、来源集合、格式、语言与 URI 提取为所属对象的工程属性。
- 绘制 PolyLine / Line / CenterLine / Shape / Polygon / Circle / Ellipse / TrimmedCurve / Text。圆和椭圆离散成折线；椭圆弧按 Proteus 极角换算参数角。支持实体面填充，Hatch 只显示轮廓并给出提示。
- 通过 ComponentName 解析 ShapeCatalogue，应用 Position / Axis / Reference / Scale 的平移、旋转、非均匀缩放与镜像。按 C01 参考 XML 与配套 SVG 的约定，负 Axis.Z 在旋转前镜像符号的局部 X 轴，并与 Scale 叠加；缺省 Axis 按正方向处理。导出文件中对象自身的文字和坐标按绝对图纸坐标处理，避免重复变换。
- 保留文字和图形的原始图纸单位，米单位图纸不会被最小字号或最小画布尺寸放大、缩小。保留 Presentation 原色及线宽，使用 Text 指定的字体（未安装时由浏览器回退），支持文字对齐和常见虚线。线宽随缩放更新，缩小文字使用 mipmap 减少断笔。
- 文字优先使用显式 String / Value；缺少显式文本时解析 DependantAttribute 中的属性占位符、ItemID 及 TextStringFormatSpecification。引用不存在时给出提示。
- 提取 Connection 的 FromID / ToID / FromNode / ToNode；检查 Association 和 ObjectAttributesReference 是否能找到目标。开放管端可以只定义一端，不人为补全连接。
- 符号库定义保留在 XML 树中，不重复当成实际设备或直接画在原点。分类计数是实际语义对象数，设备分类包含设备子部件和管口；不只统计主设备。
- 没有真实几何坐标时保留层级与属性并提示，不生成推测的流程图。
- 拒绝 XML 语法错误、DOCTYPE / ENTITY 声明和无关根节点；限制为 30 MB、100,000 个元素与 256 层嵌套。

DEXPI 2.0 原生 `Model` 可以读取 XML 层级、原始属性和文本，但其原生图形与工程模型映射尚未实现，界面会明确提示。查看完整画布请使用 Proteus / DEXPI 1.x 导出。解析器不是 XSD 验证器，也没有宣称通过全部厂商导出或完整 DEXPI 一致性认证。文字字体回退、斜体角度、复杂曲面和部分厂商扩展暂不完全还原。WebGL 与 SVG 的抗锯齿和线端处理不同，部分参考 SVG 的 non-scaling-stroke 也会在缩放时保留固定像素宽度，因此不承诺逐像素一致。

## 本地 TrainingTestCases 回归

在项目目录运行 `npm test`、`npm run test:e2e`，以及 `npm run audit:corpus`。全量检查默认读取相邻的 `../TrainingTestCases-master`，包括大写 `.XML` 后缀，不修改原始数据。其他目录可用 `npm run audit:corpus -- "路径"` 指定。

[全量检查报告](./corpus-audit.md) 列出 220 个源文件的检查结果及没有绘图坐标的文件；[JSON 明细](./corpus-audit.json) 包含每个文件的告警。没有图形坐标的纯语义 XML 仍可查看结构和属性，但无法直接恢复参考 PPT / PNG 的原始排版。C02 的文字、字号和几何另有同目录 SVG 数值回归测试，并保留浏览器视觉核查截图。
