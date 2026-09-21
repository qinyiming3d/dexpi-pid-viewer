# TrainingTestCases 解析检查

检查 220 个 XML（包括大写 .XML）：220 个语法解析成功，0 个失败；178 个生成图元，42 个源文件没有图形坐标。

检查覆盖所有 XML 的语法、图元坐标有限性、图元所属节点、原始字高保留、缺失属性和引用告警。没有逐像素验证全部 PPT / PNG；告警为零不代表图像与参考完全一致。C02 的 63 个文字、94 个 path、10 个 polygon 另有 SVG 回归对照（文本、字号、变换后顶点和完整圆弧采样）。

具体例：dexpi 1.3/example pids/E01 Tank/E01V02-VER.EX01.xml 已读取 27 个节点，包括 T4750 储罐及两个 Chamber 的属性；文件没有 Drawing、Position、轮廓线或 ShapeCatalogue，所以图元数为 0。相邻 PPTX 是独立参考资料，不提供给 XML 解析器可直接还原的排版坐标。

共有 57 个文件含小于 0.1 drawing unit 的明确字高。修复前这些字号被截为 0.1；目前 0 个文件仍有直接文字字号不一致。米单位 C02 的 0.002 曾被放大 50 倍，C03 的 0.005 曾被放大 20 倍。

共有 51 个文件的 314 个 Text 没有 String / Value，而以 DependantAttribute + ItemID 引用属性。现在尝试解析表达式；源属性本身缺失时保留告警。1.3 C01/C02/C03 的 TextStringFormatSpecification 均另有显式 String，以显式文本为准。

18 个文件的 CenterLine 没有有效坐标，全部属于下列 42 个无图形文件（例如 NumPoints="0"）。源文件只提供设备、属性和连接关系，同目录 PPT / PNG 是参考示意图，XML 本身不足以还原原始排版。此类文件应显示明确提示，不应虚构坐标。

## 无图形坐标的源文件

- dexpi 1.2/example pids/C02 DEXPI Example Complete E+P/C02V01-VER.EX01.xml
- dexpi 1.2/example pids/C06 Tank in PlantStructure/C06V01-VER.EX01.xml
- dexpi 1.2/example pids/E01 Tank/E01V01-VER.EX01.xml
- dexpi 1.2/example pids/E01 Tank/E01V02-VER.EX01.xml
- dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-VER.EX01.xml
- dexpi 1.2/example pids/E02 Tank with Nozzles/E02V02-VER.EX01.xml
- dexpi 1.2/example pids/E03 Pump With Nozzles/E03V01-VER.EX01.xml
- dexpi 1.2/example pids/E07 PressureVessel with ColumnSections/E07V01-VER.EX01.xml
- dexpi 1.2/example pids/E14 Tank with Standard Plant Structure Information/E14V01-VER.EX01.xml
- dexpi 1.2/example pids/I01 Measurement/I01V01-VER.EX01.xml
- dexpi 1.3/example pids/E01 Tank/E01V02-VER.EX01.xml
- dexpi 1.3/example pids/E02 Tank with Nozzles/E02V02-VER.EX01.xml
- dexpi 1.3/example pids/E03 Pump With Nozzles/E03V01-VER.EX01.xml
- dexpi 1.3/example pids/E04 HeatExchanger With Nozzles/E04V01-VER.EX01.xml
- dexpi 1.3/example pids/E05 Pump With Nozzles And HeatExchanger With Nozzles/E05V01-VER.EX01.xml
- dexpi 1.3/example pids/E06 Pump, HeatExchanger, Nozzles Connected With PNS/E06V01-VER.EX01.xml
- dexpi 1.3/example pids/E07 PressureVessel with ColumnSections/E07V01-VER.EX01.xml
- dexpi 1.3/example pids/E08 ProcessColumn with ColumnSections/E08V01-VER.EX01.xml
- dexpi 1.3/example pids/E09 Tank with equipment bar/E09V01-VER.EX01.xml
- dexpi 1.3/example pids/E11 Heat Exchanger with Chambers and Equipment Bar/E11V01-VER.EX01.xml
- dexpi 1.3/example pids/E12 Heat Exchanger with Chambers, Nozzles and Equipment Bar/E12V01-VER.EX01.xml
- dexpi 1.3/example pids/E13 Tank with Plant Structure Information/E13V01-VER.EX01.xml
- dexpi 1.3/example pids/E14 Tank with Standard Plant Structure Information/E14V01-VER.EX01.xml
- dexpi 1.3/example pids/I01 Measurement/I01V01-VER.EX01.xml
- dexpi 1.3/example pids/I02 Control/I02V01-VER.EX01.xml
- dexpi 1.3/example pids/I03 Measurement and Control/I03V01-VER.EX01.xml
- dexpi 1.3/example pids/I04 Measurement and Control/I04V01-VER.EX01.xml
- dexpi 1.3/example pids/I05 Two flow indications and flow ratio control in CCR/I05V01-VER.EX01.xml
- dexpi 1.3/example pids/I06 CCR flow indication and high alarm, flow control, control valve/I06V01-VER.EX01.xml
- dexpi 1.3/example pids/I07 Local and CCR pressure indic., alarm and safety switch/I07V01-VER.EX01.xml
- dexpi 1.3/example pids/I08 Local pressure indication, CCR pressure indication, alarms and switches/I08V01-VER.EX01.xml
- dexpi 1.3/example pids/I09 Measurement/I09V01-VER.EX01.xml
- dexpi 1.3/example pids/I10 Measurement/I10V01-VER.EX01.xml
- dexpi 1.3/example pids/I11 Measurement/I11V01-VER.EX01.xml
- dexpi 1.3/example pids/I12 Control/I12V01-VER.EX01.xml
- dexpi 1.3/example pids/I13 Measurement/I13V01-VER.EX01.xml
- dexpi 1.3/example pids/I14 Measurement/I14V01-VER.EX01.xml
- dexpi 1.3/example pids/I15 Measurement/I15V01-VER.EX01.xml
- dexpi 1.3/example pids/P01 Pipe FromTo Nozzles/P01V01-VER.EX01.xml
- dexpi 1.3/example pids/P02 Pipe From OPC to Nozzle/P02V01-VER.EX01.xml
- dexpi 1.3/example pids/P03 Pipe With Edge/P03V01-VER.EX01.xml
- dexpi 1.3/example pids/P04 Pipe With Intersection/P04V01-VER.EX01.xml

## 全量结果

| XML | 单位 | 图元 | 文字 | 属性文字（源无 String） | 告警数 |
| --- | --- | ---: | ---: | ---: | ---: |
| dexpi 1.2/example pids/C01 the complete DEXPI PnID/C01V01-HEX.EX01.xml | Metre | 1091 | 400 | 0 | 2 |
| dexpi 1.2/example pids/C01 the complete DEXPI PnID/C01V01-HEX.EX02.xml | Metre | 940 | 249 | 2 | 1 |
| dexpi 1.2/example pids/C01 the complete DEXPI PnID/C01V01-HEX.EX03.xml | Metre | 986 | 295 | 0 | 0 |
| dexpi 1.2/example pids/C01 the complete DEXPI PnID/C01V01-SAG.EX01.XML | mm | 1372 | 283 | 9 | 2 |
| dexpi 1.2/example pids/C01 the complete DEXPI PnID/C01V01-SAG.EX02.XML | mm | 1150 | 271 | 9 | 1 |
| dexpi 1.2/example pids/C02 DEXPI Example Complete E+P/C02V01-AVV.EX01.xml | mm | 602 | 272 | 0 | 0 |
| dexpi 1.2/example pids/C02 DEXPI Example Complete E+P/C02V01-HEX.EX02.xml | Metre | 915 | 282 | 0 | 0 |
| dexpi 1.2/example pids/C02 DEXPI Example Complete E+P/C02V01-ING.EX01.xml | Metre | 532 | 190 | 4 | 1 |
| dexpi 1.2/example pids/C02 DEXPI Example Complete E+P/C02V01-VER.EX01.xml | mm | 0 | 0 | 0 | 4 |
| dexpi 1.2/example pids/C03 DEXPI Example Tank Displ Pump Pipe with Tee/C03V01-AVV.EX01.xml | mm | 324 | 130 | 0 | 0 |
| dexpi 1.2/example pids/C03 DEXPI Example Tank Displ Pump Pipe with Tee/C03V01-HEX.EX02.xml | Metre | 173 | 35 | 0 | 0 |
| dexpi 1.2/example pids/C03 DEXPI Example Tank Displ Pump Pipe with Tee/C03V01-ING.EX01.xml | Metre | 257 | 78 | 4 | 1 |
| dexpi 1.2/example pids/C03 DEXPI Example Tank Displ Pump Pipe with Tee/C03V01-SAG.EX01.XML | mm | 163 | 11 | 0 | 0 |
| dexpi 1.2/example pids/C04 DEXPI Example Pump Plate Heat Exchanger/C04V01-AVV.EX01.xml | mm | 237 | 122 | 0 | 0 |
| dexpi 1.2/example pids/C04 DEXPI Example Pump Plate Heat Exchanger/C04V01-HEX.EX02.xml | Metre | 63 | 18 | 0 | 0 |
| dexpi 1.2/example pids/C04 DEXPI Example Pump Plate Heat Exchanger/C04V01-ING.EX01.xml | Metre | 147 | 64 | 4 | 1 |
| dexpi 1.2/example pids/C04 DEXPI Example Pump Plate Heat Exchanger/C04V01-SAG.EX01.XML | mm | 71 | 8 | 0 | 0 |
| dexpi 1.2/example pids/C05 Pump- Tank- and Control loop/C05V01-SAG.EX01.XML | mm | 110 | 10 | 0 | 0 |
| dexpi 1.2/example pids/C06 Tank in PlantStructure/C06V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/E01 Tank/E01.V02.ING.EX01.xml | Metre | 5 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-AUD.EX01.xml | mm | 6 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-AUD.EX02.xml | mm | 6 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-AUD.EX03.xml | mm | 5 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-AUD.EX04.xml | mm | 5 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-AVV.EX01.xml | Millimetre | 18 | 3 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-AVV.EX02.xml | Millimetre | 18 | 3 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-AVV.EX03.xml | mm | 602 | 38 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-AVV.EX04.xml | mm | 602 | 38 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-HEX.EX02.xml | Metre | 5 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-HEX.EX03.xml | Metre | 5 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-ING.EX01.xml | Metre | 45 | 26 | 17 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-ING.EX02.xml | Metre | 45 | 26 | 17 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-SAG.EX01.xml | mm | 8 | 1 | 1 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-SAG.EX02.xml | mm | 8 | 1 | 1 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/E01 Tank/E01V02-AUD.EX01.xml | mm | 5 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V02-HEX.EX1.xml | Metre | 5 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E01 Tank/E01V02-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-AUD.EX01.xml | mm | 20 | 5 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-AUD.EX02.xml | mm | 20 | 6 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-AVV.EX01.xml | Millimetre | 25 | 5 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-AVV.EX02.xml | mm | 611 | 42 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-AVV.EX03.xml | mm | 611 | 42 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-HEX.EX02.xml | Metre | 25 | 11 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-ING.EX01.xml | Metre | 65 | 36 | 27 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-ING.EX02-AUD.IM01.xml | mm | 4 | 0 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-SAG.EX01.xml | mm | 115 | 35 | 20 | 4 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-SAG.EX02.xml | mm | 116 | 35 | 20 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V02-AUD.EX01.xml | mm | 28 | 8 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V02-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/E02 Tank with Nozzles/E02V02.HEX.EX1.xml | Metre | 25 | 11 | 0 | 0 |
| dexpi 1.2/example pids/E02 Tank with nozzels/E02V01-HEX.EX04.xml | Metre | 29 | 13 | 0 | 0 |
| dexpi 1.2/example pids/E03 HeatExchanger With Nozzles/E03V01-HEX.EX02.xml | Metre | 405 | 76 | 0 | 0 |
| dexpi 1.2/example pids/E03 Pump With Nozzles/E03V01-AUD.EX01.xml | mm | 9 | 2 | 0 | 0 |
| dexpi 1.2/example pids/E03 Pump With Nozzles/E03V01-AUD.EX02.xml | mm | 9 | 2 | 0 | 0 |
| dexpi 1.2/example pids/E03 Pump With Nozzles/E03V01-AVV.EX01.xml | mm | 603 | 40 | 0 | 0 |
| dexpi 1.2/example pids/E03 Pump With Nozzles/E03V01-SAG.EX01.XML | mm | 8 | 2 | 0 | 0 |
| dexpi 1.2/example pids/E03 Pump With Nozzles/E03V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/E03 Pump With Nozzles/E03V02-AUD.EX01.xml | mm | 9 | 2 | 0 | 0 |
| dexpi 1.2/example pids/E04 HeatExchanger With Nozzles/E04V01-AUD.EX01.xml | mm | 18 | 4 | 0 | 0 |
| dexpi 1.2/example pids/E04 HeatExchanger With Nozzles/E04V01-AUD.EX02.xml | mm | 16 | 3 | 0 | 0 |
| dexpi 1.2/example pids/E04 HeatExchanger With Nozzles/E04V01-AVV.EX01.xml | mm | 615 | 44 | 0 | 0 |
| dexpi 1.2/example pids/E04 HeatExchanger With Nozzles/E04V01-HEX.EX02.xml | Metre | 26 | 9 | 0 | 0 |
| dexpi 1.2/example pids/E04 HeatExchanger With Nozzles/E04V01-SAG.EX01.XML | mm | 21 | 4 | 0 | 0 |
| dexpi 1.2/example pids/E04 HeatExchanger With Nozzles/E04V02-AUD.EX01.xml | mm | 18 | 4 | 0 | 0 |
| dexpi 1.2/example pids/E05 Pump With Nozzles And HeatExchanger With Nozzles/E05V01-AUD.EX01.xml | mm | 27 | 6 | 0 | 0 |
| dexpi 1.2/example pids/E05 Pump With Nozzles And HeatExchanger With Nozzles/E05V01-AUD.EX02.xml | mm | 25 | 5 | 0 | 0 |
| dexpi 1.2/example pids/E05 Pump With Nozzles And HeatExchanger With Nozzles/E05V01-AVV.EX01.xml | mm | 629 | 47 | 0 | 0 |
| dexpi 1.2/example pids/E05 Pump With Nozzles And HeatExchanger With Nozzles/E05V01-HEX.EX02.xml | Metre | 39 | 14 | 0 | 0 |
| dexpi 1.2/example pids/E05 Pump With Nozzles And HeatExchanger With Nozzles/E05V01-SAG.EX01.XML | mm | 29 | 6 | 0 | 0 |
| dexpi 1.2/example pids/E05 Pump With Nozzles And HeatExchanger With Nozzles/E05V02-AUD.EX01.xml | mm | 21 | 4 | 0 | 0 |
| dexpi 1.2/example pids/E06 Pump%2C HeatExchanger%2C Nozzles Connected With PNS/E06V01-HEX.EX02.xml | Metre | 41 | 15 | 0 | 0 |
| dexpi 1.2/example pids/E06 Pump, HeatExchanger, Nozzles Connected With PNS/E06V01-AUD.EX01.xml | mm | 33 | 9 | 0 | 0 |
| dexpi 1.2/example pids/E06 Pump, HeatExchanger, Nozzles Connected With PNS/E06V01-AVV.EX01.xml | mm | 632 | 48 | 0 | 0 |
| dexpi 1.2/example pids/E06 Pump, HeatExchanger, Nozzles Connected With PNS/E06V01-SAG.EX01.XML | mm | 39 | 8 | 0 | 0 |
| dexpi 1.2/example pids/E06 Pump, HeatExchanger, Nozzles Connected With PNS/E06V02-AUD.EX01.xml | mm | 34 | 9 | 0 | 0 |
| dexpi 1.2/example pids/E07 PressureVessel with ColumnSections/E07V01-HEX.EX02.xml | Metre | 52 | 9 | 0 | 0 |
| dexpi 1.2/example pids/E07 PressureVessel with ColumnSections/E07V01-SAG.EX01.XML | mm | 72 | 7 | 0 | 0 |
| dexpi 1.2/example pids/E07 PressureVessel with ColumnSections/E07V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/E08 ProcessColumn with ColumnSections/E08V01-SAG.EX01.XML | mm | 72 | 7 | 0 | 0 |
| dexpi 1.2/example pids/E09 Tank with equipment bar/E09V01-HEX.EX02.xml | Metre | 84 | 48 | 0 | 0 |
| dexpi 1.2/example pids/E09 Tank with equipment bar/E09V01-SAG.EX01.XML | mm | 31 | 9 | 2 | 0 |
| dexpi 1.2/example pids/E11 Heat Exchanger with Chambers and Equipment Bar/E11V01-SAG.EX01.XML | mm | 18 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E12 Heat Exchanger with Chambers, Nozzles and Equipment Bar/E12V01-SAG.EX01.XML | mm | 27 | 6 | 0 | 0 |
| dexpi 1.2/example pids/E13 Tank with Plant Structure Information/E13V01-SAG.EX01.XML | mm | 9 | 1 | 0 | 0 |
| dexpi 1.2/example pids/E14 Tank with Standard Plant Structure Information/E14V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/I01 Measurement/I01V01-AVV.EX01.xml | mm | 644 | 56 | 0 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V01-DXI.EX01.xml | mm | 22 | 5 | 1 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V01-SAG.EX01.xml | mm | 43 | 7 | 5 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V01-SAG.EX02.xml | mm | 18 | 3 | 0 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.2/example pids/I01 Measurement/I01V01_AUD.EX01.xml | mm | 16 | 3 | 2 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V02-HEX.EX03.xml | Metre | 16 | 3 | 0 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V02-ING.EX01.xml | Metre | 17 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V02-SAG.EX01.xml | mm | 43 | 7 | 5 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V02-SAG.EX02.xml | mm | 43 | 7 | 5 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V02-SAG.EX03.xml | mm | 44 | 7 | 5 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V02.HEX.EX02.xml | Metre | 16 | 3 | 0 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V02.HEX.EX1.xml | Metre | 18 | 5 | 0 | 0 |
| dexpi 1.2/example pids/I01 Measurement/I01V02_AUD.EX01.xml | Angstrom | 16 | 3 | 2 | 0 |
| dexpi 1.2/example pids/I02 Control/I02.V01-ING.EX01.xml | Metre | 19 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I02 Control/I02.V01-ING.EX02.xml | Metre | 19 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I02 Control/I02V01-AVV.EX01.xml | mm | 704 | 60 | 0 | 0 |
| dexpi 1.2/example pids/I02 Control/I02V01-HEX.EX02.xml | Metre | 22 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I02 Control/I02V01-HEX.EX03.xml | Metre | 369 | 46 | 0 | 0 |
| dexpi 1.2/example pids/I02 Control/I02V01-SAG.EX01.xml | mm | 31 | 3 | 0 | 0 |
| dexpi 1.2/example pids/I02 Control/I02V01_AUD.EX01.xml | mm | 18 | 3 | 2 | 1 |
| dexpi 1.2/example pids/I02 Control/I02V02_AUD.EX01.xml | mm | 18 | 3 | 2 | 0 |
| dexpi 1.2/example pids/I03 Measurement and Control/I03V01-AVV.EX01.xml | mm | 723 | 65 | 0 | 0 |
| dexpi 1.2/example pids/I03 Measurement and Control/I03V01-HEX.EX02.xml | Metre | 27 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I03 Measurement and Control/I03V01-HEX.EX03.xml | Metre | 374 | 46 | 0 | 0 |
| dexpi 1.2/example pids/I03 Measurement and Control/I03V01-SAG.EX01.xml | mm | 39 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I03 Measurement and Control/I03V01_AUD.EX01.xml | mm | 25 | 3 | 2 | 1 |
| dexpi 1.2/example pids/I03 Measurement and Control/I03V02_AUD.EX01.xml | mm | 26 | 3 | 2 | 0 |
| dexpi 1.2/example pids/I04 Measurement and Control/I04.V01-ING.EX01.xml | Metre | 31 | 5 | 0 | 0 |
| dexpi 1.2/example pids/I04 Measurement and Control/I04.V01-ING.EX02.xml | Metre | 59 | 17 | 0 | 0 |
| dexpi 1.2/example pids/I04 Measurement and Control/I04.V01-ING.EX03.xml | Metre | 59 | 17 | 0 | 0 |
| dexpi 1.2/example pids/I04 Measurement and Control/I04V01-HEX.EX04.xml | Metre | 35 | 9 | 0 | 0 |
| dexpi 1.2/example pids/I04 Measurement and Control/I04V01-HEX.EX05.xml | Metre | 381 | 51 | 0 | 0 |
| dexpi 1.2/example pids/I04 Measurement and Control/I04V01-SAG.EX01.xml | mm | 46 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I04 Measurement and Control/I04V01_AUD.EX01.xml | mm | 29 | 4 | 2 | 1 |
| dexpi 1.2/example pids/I04 Measurement and Control/I04V02_AUD.EX01.xml | mm | 31 | 5 | 2 | 0 |
| dexpi 1.2/example pids/I05 Two flow indications and flow ratio control in CCR/I05V01-SAG.EX01.xml | mm | 79 | 9 | 0 | 1 |
| dexpi 1.2/example pids/I05 Two flow indications and flow ratio control in CCR/I05V01_AUD.EX01.xml | mm | 59 | 8 | 8 | 0 |
| dexpi 1.2/example pids/I05 Two flow indications and flow ratio control in CCR/I05V02_AUD.EX01.xml | mm | 38 | 2 | 2 | 0 |
| dexpi 1.2/example pids/I06 CCR flow indication and high alarm, flow control, control valve/I06V01-SAG.EX01.xml | mm | 60 | 10 | 0 | 1 |
| dexpi 1.2/example pids/I06 CCR flow indication and high alarm, flow control, control valve/I06V01_AUD.EX01.xml | mm | 44 | 6 | 6 | 0 |
| dexpi 1.2/example pids/I06 CCR flow indication and high alarm, flow control, control valve/I06V02_AUD.EX01.xml | mm | 42 | 12 | 4 | 0 |
| dexpi 1.2/example pids/I07 Local and CCR pressure indic., alarm and safety switch/I07V01-SAG.EX01.xml | mm | 51 | 8 | 0 | 0 |
| dexpi 1.2/example pids/I07 Local and CCR pressure indic., alarm and safety switch/I07V01_AUD.EX01.xml | mm | 29 | 6 | 6 | 0 |
| dexpi 1.2/example pids/I07 Local and CCR pressure indic., alarm and safety switch/I07V02_AUD.EX01.xml | mm | 29 | 10 | 6 | 0 |
| dexpi 1.2/example pids/I08 Local pressure indication, CCR pressure indication, alarms and switches/I08V01-SAG.EX01.xml | mm | 55 | 12 | 0 | 0 |
| dexpi 1.2/example pids/I08 Local pressure indication, CCR pressure indication, alarms and switches/I08V01_AUD.EX01.xml | mm | 48 | 8 | 8 | 4 |
| dexpi 1.2/example pids/I08 Local pressure indication, CCR pressure indication, alarms and switches/I08V02_AUD.EX01.xml | mm | 39 | 10 | 6 | 0 |
| dexpi 1.2/example pids/I09 Measurement/I09V01-SAG.EX01.xml | mm | 17 | 3 | 0 | 0 |
| dexpi 1.2/example pids/I09 Measurement/I09V01_AUD.EX01.xml | mm | 15 | 3 | 2 | 0 |
| dexpi 1.2/example pids/I09 Measurement/I09V02-HEX.EX02.xml | Metre | 15 | 3 | 0 | 0 |
| dexpi 1.2/example pids/I09 Measurement/I09V02-HEX.EX03.xml | Metre | 362 | 45 | 0 | 0 |
| dexpi 1.2/example pids/I09 Measurement/I09V02.HEX.EX1.xml | Metre | 15 | 3 | 0 | 0 |
| dexpi 1.2/example pids/I09 Measurement/I09V02_AUD.EX01.xml | mm | 16 | 3 | 2 | 0 |
| dexpi 1.2/example pids/I10 Measurement/I10V01-SAG.EX01.xml | mm | 17 | 2 | 0 | 0 |
| dexpi 1.2/example pids/I10 Measurement/I10V01_AUD.EX01.xml | mm | 9 | 2 | 2 | 0 |
| dexpi 1.2/example pids/I10 Measurement/I10V02_AUD.EX01.xml | mm | 9 | 2 | 2 | 0 |
| dexpi 1.2/example pids/I11 Measurement/I11.V01-ING.EX01.xml | Metre | 21 | 5 | 0 | 0 |
| dexpi 1.2/example pids/I11 Measurement/I11V01-HEX.EX02.xml | Metre | 20 | 5 | 0 | 0 |
| dexpi 1.2/example pids/I11 Measurement/I11V01-HEX.EX03.xml | Metre | 367 | 47 | 0 | 0 |
| dexpi 1.2/example pids/I11 Measurement/I11V01-SAG.EX01.xml | mm | 21 | 2 | 0 | 1 |
| dexpi 1.2/example pids/I11 Measurement/I11V01_AUD.EX01I.xml | mm | 19 | 3 | 2 | 1 |
| dexpi 1.2/example pids/I11 Measurement/I11V02_AUD.EX01.xml | mm | 20 | 4 | 2 | 0 |
| dexpi 1.2/example pids/I12 Control/I12.V01-ING.EX01.xml | Metre | 22 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I12 Control/I12V01-HEX.EX02.xml | Metre | 22 | 4 | 0 | 0 |
| dexpi 1.2/example pids/I12 Control/I12V01-HEX.EX03.xml | Metre | 369 | 46 | 0 | 0 |
| dexpi 1.2/example pids/I12 Control/I12V01-SAG.EX01.xml | mm | 32 | 3 | 0 | 0 |
| dexpi 1.2/example pids/I12 Control/I12V01_AUD.EX01.xml | mm | 18 | 3 | 2 | 1 |
| dexpi 1.2/example pids/I12 Control/I12V02_AUD.EX01.xml | mm | 18 | 3 | 2 | 0 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-AUD.EX01.xml | mm | 24 | 5 | 0 | 0 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-AVV.EX01.xml | mm | 623 | 44 | 0 | 0 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-AVV.EX02.xml | mm | 623 | 44 | 0 | 0 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-HEX.EX03.xml | Metre | 23 | 5 | 0 | 0 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-ING.EX01.xml | Metre | 21 | 3 | 3 | 0 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-ING.EX02-AUD.EX01.xml | mm | 5 | 0 | 0 | 0 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-ING.EX02.xml | Metre | 21 | 3 | 3 | 0 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-SAG.EX01.xml | mm | 173 | 50 | 23 | 4 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-SAG.EX02-AUD.EX01.xml | mm | 6 | 0 | 0 | 1 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V01-SAG.EX02.xml | mm | 175 | 50 | 23 | 2 |
| dexpi 1.2/example pids/P01 Pipe FromTo Nozzles/P01V02-AUD.EX01.xml.xml | mm | 24 | 5 | 0 | 0 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/2RENAME/P02V01-INTERGRAPH_Post.xml | Metre | 19 | 5 | 3 | 0 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/2RENAME/P02V01-INTERGRAPH_Post_C.xml | Metre | 19 | 5 | 3 | 0 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/2RENAME/P02V01_INGV02-AUDV01.xml | mm | 5 | 0 | 0 | 0 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/P02V01-AVV.EX01.xml | mm | 610 | 42 | 0 | 0 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/P02V01-AVV.EX02.xml | mm | 610 | 42 | 0 | 0 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/P02V01-SAG.EX02-AUD.IM01.xml | mm | 6 | 0 | 0 | 1 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/P02V01-SAG.EX02.xml | mm | 74 | 20 | 10 | 2 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/P02V01_SAG.EX01.xml | mm | 74 | 20 | 10 | 2 |
| dexpi 1.2/example pids/P02 Pipe From OPC to Nozzle/P02V02-HEX.EX02.xml | Metre | 19 | 5 | 0 | 0 |
| dexpi 1.2/example pids/P03 Pipe With Edge/P03V01-AUD.EX01.xml | mm | 17 | 3 | 0 | 1 |
| dexpi 1.2/example pids/P03 Pipe With Edge/P03V01-AVV.EX01.xml | mm | 611 | 41 | 0 | 0 |
| dexpi 1.2/example pids/P03 Pipe With Edge/P03V01-SAG.EX01.XML | mm | 27 | 3 | 0 | 0 |
| dexpi 1.2/example pids/P03 Pipe With Edge/P03V02-AUD.EX01.xml.xml | mm | 17 | 3 | 0 | 1 |
| dexpi 1.2/example pids/P04 Pipe With Intersection/P04V01-AUD.EX01.xml | mm | 21 | 5 | 0 | 0 |
| dexpi 1.2/example pids/P04 Pipe With Intersection/P04V01-AVV.EX01.xml | mm | 632 | 47 | 0 | 0 |
| dexpi 1.2/example pids/P04 Pipe With Intersection/P04V01-AVV.EX02.xml | mm | 632 | 47 | 0 | 0 |
| dexpi 1.2/example pids/P04 Pipe With Intersection/P04V01-SAG.EX01.XML | mm | 36 | 5 | 0 | 0 |
| dexpi 1.2/example pids/P04 Pipe With Intersection/P04V02-AUD.EX01.xml.xml | mm | 21 | 5 | 0 | 0 |
| dexpi 1.3/example pids/C01 DEXPI Reference P&ID/C01V04-VER.EX01.xml | mm | 564 | 245 | 0 | 0 |
| dexpi 1.3/example pids/C02 Process Column (BASF)/C02V03-VER.EX02.xml | m | 167 | 63 | 0 | 0 |
| dexpi 1.3/example pids/C03 Piping (Equinor)/C03V04-VER.EX02.xml | m | 55 | 12 | 0 | 0 |
| dexpi 1.3/example pids/E01 Tank/E01V02-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E02 Tank with Nozzles/E02V02-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E03 Pump With Nozzles/E03V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E04 HeatExchanger With Nozzles/E04V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E05 Pump With Nozzles And HeatExchanger With Nozzles/E05V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E06 Pump, HeatExchanger, Nozzles Connected With PNS/E06V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/E07 PressureVessel with ColumnSections/E07V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E08 ProcessColumn with ColumnSections/E08V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E09 Tank with equipment bar/E09V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E11 Heat Exchanger with Chambers and Equipment Bar/E11V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E12 Heat Exchanger with Chambers, Nozzles and Equipment Bar/E12V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E13 Tank with Plant Structure Information/E13V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/E14 Tank with Standard Plant Structure Information/E14V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/I01 Measurement/I01V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/I02 Control/I02V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I03 Measurement and Control/I03V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I04 Measurement and Control/I04V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I05 Two flow indications and flow ratio control in CCR/I05V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I06 CCR flow indication and high alarm, flow control, control valve/I06V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I07 Local and CCR pressure indic., alarm and safety switch/I07V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I08 Local pressure indication, CCR pressure indication, alarms and switches/I08V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I09 Measurement/I09V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/I10 Measurement/I10V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I11 Measurement/I11V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I12 Control/I12V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I13 Measurement/I13V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I14 Measurement/I14V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/I15 Measurement/I15V01-VER.EX01.xml | mm | 0 | 0 | 0 | 1 |
| dexpi 1.3/example pids/P01 Pipe FromTo Nozzles/P01V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/P02 Pipe From OPC to Nozzle/P02V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/P03 Pipe With Edge/P03V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |
| dexpi 1.3/example pids/P04 Pipe With Intersection/P04V01-VER.EX01.xml | mm | 0 | 0 | 0 | 2 |

每个文件的完整告警、坐标范围及检查统计见 [corpus-audit.json](./corpus-audit.json)。
