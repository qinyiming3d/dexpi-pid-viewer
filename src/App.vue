<template>
  <div
    class="app-shell"
    @dragover.prevent="dragging = true"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <header class="app-header">
      <a class="brand" href="#" @click.prevent="fit"
        ><img src="/favicon.svg" alt="" /><span
          >DEXPI<span class="brand-light"> Studio</span
          ><small>PROCESS INTELLIGENCE</small></span
        ></a
      >
      <div class="header-divider"></div>
      <span class="workspace-label">工程工作空间</span
      ><span class="edition">P&ID VIEWER</span>
      <div class="header-right">
        <span class="local-badge"><span></span> 本地解析 · 数据不上传</span
        ><button
          class="icon-button help-button"
          title="使用帮助"
          aria-label="使用帮助"
          @click="showHelp = true"
        >
          <app-icon name="circle-help" />
        </button>
        <div class="avatar">DE</div>
      </div>
    </header>

    <div class="app-body">
      <nav class="nav-rail" aria-label="工作区导航">
        <button
          class="rail-button active"
          title="流程图工作台"
          aria-label="流程图工作台"
          @click="leftPanel = 'tree'"
        >
          <app-icon name="network" :size="22" /><span>工作台</span>
        </button>
        <button
          class="rail-button"
          :class="{ active: showSamples }"
          title="示例文件"
          aria-label="示例文件"
          @click="showSamples = true"
        >
          <app-icon name="folder-open" :size="21" /><span>示例库</span>
        </button>
        <button
          class="rail-button"
          :class="{ active: leftPanel === 'layers' }"
          title="图层管理"
          aria-label="图层管理"
          @click="leftPanel = leftPanel === 'layers' ? 'tree' : 'layers'"
        >
          <app-icon name="layers" :size="21" /><span>图层</span>
        </button>
        <div class="rail-spacer"></div>
        <button
          class="rail-button"
          title="数据来源与格式支持"
          aria-label="数据来源与格式支持"
          @click="showAbout = true"
        >
          <app-icon name="info" :size="21" /></button
        ><span class="rail-version">v1.0</span>
      </nav>

      <main class="main-workspace">
        <section class="page-heading">
          <div>
            <div class="eyebrow">ENGINEERING / DIAGRAM EXPLORER</div>
            <h1>P&ID 工作台 <span class="heading-chip">DEXPI</span></h1>
            <p>从图纸到数据，探索每一个设备、管线与连接。</p>
          </div>
          <div class="heading-actions">
            <button
              class="button secondary"
              :disabled="!model || loading"
              @click="exportMenu = !exportMenu"
            >
              <app-icon name="download" :size="16" />导出<app-icon
                name="chevron-down"
                :size="14"
              /></button
            ><button
              class="button primary"
              :disabled="loading"
              @click="$refs.fileInput.click()"
            >
              <app-icon name="upload" :size="16" />导入 XML
            </button>
            <div v-if="exportMenu" class="export-menu">
              <button @click="exportJson">
                <app-icon name="file-json" :size="16" />导出解析数据 JSON</button
              ><button @click="exportPng">
                <app-icon name="download" :size="16" />导出当前画布 PNG</button
              ><button @click="exportXml">
                <app-icon name="file-code-2" :size="16" />下载原始 XML
              </button>
            </div>
          </div>
        </section>

        <section class="document-workspace">
          <div class="document-bar">
            <div class="document-title">
              <span class="file-square"
                ><app-icon name="file-code-2" :size="17" /></span
              ><strong>{{ fileName || "未打开文件" }}</strong
              ><span class="document-format">{{
                model ? model.format : "XML"
              }}</span
              ><span v-if="model" class="loaded-check"
                ><app-icon name="check" :size="13" /> 已加载</span
              >
            </div>
            <button
              class="text-button"
              :disabled="loading"
              @click="showSamples = true"
            >
              切换示例<app-icon name="chevrons-up-down" :size="14" />
            </button>
          </div>
          <div
            class="editor-layout"
            :class="{
              'model-hidden': modelHidden,
              'inspector-open': inspectorOpen,
            }"
          >
            <aside class="model-panel">
              <div class="panel-heading">
                <h2>{{ leftPanel === "tree" ? "模型浏览器" : "图层管理" }}</h2>
                <button
                  class="icon-button small"
                  :title="leftPanel === 'tree' ? '收起全部节点' : '显示模型树'"
                  :aria-label="
                    leftPanel === 'tree' ? '收起全部节点' : '显示模型树'
                  "
                  @click="
                    leftPanel === 'tree' ? collapseTree() : (leftPanel = 'tree')
                  "
                >
                  <app-icon
                    :name="leftPanel === 'tree' ? 'list-tree' : 'arrow-left'"
                    :size="17"
                  />
                </button>
              </div>
              <template v-if="leftPanel === 'tree'">
                <div class="tree-search">
                  <app-icon name="search" :size="16" /><input
                    ref="searchInput"
                    v-model="query"
                    aria-label="搜索节点"
                    placeholder="搜索名称、位号或 ID…"
                  /><kbd v-if="!query">/</kbd
                  ><button
                    v-else
                    class="icon-button small"
                    aria-label="清空搜索"
                    @click="query = ''"
                  >
                    <app-icon name="x" :size="13" />
                  </button>
                </div>
                <div class="segmented">
                  <button
                    :class="{ active: treeMode === 'model' }"
                    @click="changeTreeMode('model')"
                  >
                    结构模型</button
                  ><button
                    :class="{ active: treeMode === 'xml' }"
                    @click="changeTreeMode('xml')"
                  >
                    XML 节点树
                  </button>
                </div>
                <div class="tree-caption">
                  <span>{{
                    query
                      ? "搜索结果"
                      : treeMode === "model"
                        ? "工程对象层级"
                        : "XML 层级与图元实例"
                  }}</span
                  ><span
                    >{{ treeData.entries.length.toLocaleString() }} 节点</span
                  >
                </div>
                <div class="tree-scroll" role="tree" aria-label="模型节点层级">
                  <div
                    v-for="row in visibleRows"
                    :key="row.node.id"
                    :data-node-id="row.node.id"
                    class="tree-row"
                    :class="{
                      selected: selectedId === row.node.id,
                      'tree-root': row.depth === 0,
                    }"
                    :style="{ paddingLeft: 12 + row.depth * 15 + 'px' }"
                    role="treeitem"
                    :aria-level="row.depth + 1"
                    :aria-selected="selectedId === row.node.id"
                    :aria-expanded="
                      row.hasChildren
                        ? String(isExpanded(row.node.id))
                        : undefined
                    "
                    tabindex="0"
                    @click="selectNode(row.node.id)"
                    @dblclick="focusNode(row.node.id)"
                    @keydown.enter.prevent="selectNode(row.node.id)"
                    @keydown.right.prevent="expandNode(row.node.id)"
                    @keydown.left.prevent="$delete(expanded, row.node.id)"
                  >
                    <button
                      v-if="row.hasChildren"
                      class="tree-toggle"
                      :aria-label="
                        (isExpanded(row.node.id) ? '折叠 ' : '展开 ') +
                        row.node.label
                      "
                      @click.stop="toggleNode(row.node.id)"
                    >
                      <app-icon
                        :name="
                          isExpanded(row.node.id)
                            ? 'chevron-down'
                            : 'chevron-right'
                        "
                        :size="12"
                      /></button
                    ><span v-else class="tree-toggle spacer"></span
                    ><app-icon
                      :name="nodeIcon(row.node)"
                      :size="15"
                      :class="'category-' + row.node.category"
                    /><span
                      class="tree-name"
                      :title="row.node.label + ' · ' + row.node.tag"
                      >{{ treeLabel(row.node) }}</span
                    ><span v-if="row.hasChildren" class="tree-count">{{
                      row.childCount
                    }}</span
                    ><span
                      v-else-if="row.node.category === 'equipment'"
                      class="node-dot"
                    ></span>
                  </div>
                  <div v-if="model && !visibleRows.length" class="empty-tree">
                    <app-icon name="search" :size="25" />
                    <p>没有找到匹配的节点</p>
                    <small>试试设备位号或 XML 标签</small>
                  </div>
                  <div v-if="visibleRows.length >= 1000" class="tree-limit">
                    当前显示前 1,000 项，请缩小搜索范围。
                  </div>
                </div>
                <div class="model-summary">
                  <span
                    >设备
                    <b>{{ stats.equipment || 0 }}</b></span
                  ><span
                    >管道
                    <b>{{ stats.piping || 0 }}</b></span
                  ><span
                    >仪表
                    <b>{{ stats.instrumentation || 0 }}</b></span
                  >
                </div>
              </template>
              <div v-else class="layers-panel">
                <p>按对象类型控制图纸可见性</p>
                <button
                  v-for="layer in layerOptions"
                  :key="layer.id"
                  class="layer-row"
                  :class="{ disabled: !layers[layer.id] }"
                  @click="toggleLayer(layer.id)"
                >
                  <span class="layer-icon" :class="'category-' + layer.id"
                    ><app-icon :name="layer.icon" /></span
                  ><span>{{ layer.label }}</span
                  ><app-icon
                    :name="layers[layer.id] ? 'eye' : 'eye-off'"
                    :size="16"
                  />
                </button>
                <div class="layer-note">
                  <app-icon name="info" :size="16" />图层对应 XML
                  中的工程对象类型；符号库定义不会单独绘制。
                </div>
              </div>
            </aside>

            <section class="canvas-panel">
              <div class="canvas-topbar">
                <div class="canvas-tab">
                  <button
                    class="icon-button small responsive-panel-button"
                    title="切换模型树"
                    aria-label="切换模型树"
                    @click="modelHidden = !modelHidden"
                  >
                    <app-icon name="list-tree" :size="16" /></button
                  ><app-icon name="network" :size="15" />流程图<span>2D</span>
                </div>
                <div class="canvas-actions">
                  <span class="canvas-renderer">ORTHOGRAPHIC VIEW</span
                  ><button
                    class="icon-button small responsive-panel-button"
                    title="切换对象检查器"
                    aria-label="切换对象检查器"
                    @click="inspectorOpen = !inspectorOpen"
                  >
                    <app-icon name="info" :size="16" /></button
                  ><button
                    class="icon-button small"
                    :disabled="!selectedId"
                    title="定位选中对象（F）"
                    aria-label="定位选中对象"
                    @click="focusNode(selectedId)"
                  >
                    <app-icon name="crosshair" :size="17" /></button
                  ><button
                    class="icon-button small"
                    title="适应画布（Home）"
                    aria-label="适应画布"
                    @click="fit"
                  >
                    <app-icon name="maximize" :size="17" />
                  </button>
                </div>
              </div>
              <div
                ref="canvas"
                class="diagram-canvas"
                aria-label="P&ID 流程图画布"
                tabindex="0"
              ></div>
              <div class="canvas-document-label">
                <span class="tiny-green-dot"></span
                >{{ activeSample ? activeSample.name : "本地工程文件"
                }}<small>{{
                  model ? "DEXPI " + model.version : "等待导入"
                }}</small>
              </div>
              <div v-if="loading" class="canvas-loading">
                <div class="loading-spinner"></div>
                <strong>正在解析工程文件</strong
                ><span>读取节点、属性与图形坐标…</span>
              </div>
              <div
                v-else-if="canvasError || (model && !model.primitives.length)"
                class="canvas-empty"
              >
                <app-icon name="file-code-2" :size="34" /><strong>{{
                  canvasError ? "画布暂不可用" : "工程数据已解析，暂无可显示图形"
                }}</strong>
                <p>
                  {{
                    canvasError ||
                    "可在左侧查看设备与属性。绘图还需要 XML 中的图形坐标和符号定义；具体原因请查看底部解析提示。"
                  }}
                </p>
              </div>
              <div class="canvas-toolbar">
                <button
                  class="icon-button"
                  title="缩小"
                  aria-label="缩小"
                  @click="zoomBy(0.8)"
                >
                  <app-icon name="minus" :size="17" /></button
                ><button class="zoom-value" title="点击适应画布" @click="fit">
                  {{ Math.round(view.zoom) }}%</button
                ><button
                  class="icon-button"
                  title="放大"
                  aria-label="放大"
                  @click="zoomBy(1.25)"
                >
                  <app-icon name="plus" :size="17" /></button
                ><i></i
                ><button
                  class="icon-button"
                  title="适应画布"
                  aria-label="缩放至全图"
                  @click="fit"
                >
                  <app-icon name="expand" :size="17" /></button
                ><i></i
                ><button
                  class="icon-button"
                  :class="{ active: grid }"
                  :aria-pressed="String(grid)"
                  title="切换网格"
                  aria-label="切换网格"
                  @click="toggleGrid"
                >
                  <app-icon name="grid-2x2" :size="17" /></button
                ><button
                  class="icon-button"
                  :class="{ active: labels }"
                  :aria-pressed="String(labels)"
                  title="切换文字"
                  aria-label="切换文字"
                  @click="toggleLabels"
                >
                  <app-icon name="type" :size="17" />
                </button>
              </div>
              <div class="canvas-hint">
                <app-icon
                  name="mouse-pointer-2"
                  :size="13"
                />点击选择<span>·</span>拖动平移<span>·</span>滚轮缩放
              </div>
            </section>

            <aside class="inspector-panel">
              <div class="panel-heading">
                <h2>对象检查器</h2>
                <span class="inspector-live"><i></i> 实时联动</span
                ><button
                  class="icon-button small responsive-panel-button"
                  title="收起对象检查器"
                  aria-label="收起对象检查器"
                  @click="inspectorOpen = false"
                >
                  <app-icon name="x" :size="15" />
                </button>
              </div>
              <div v-if="selectedNode" class="inspector-body">
                <div class="selected-object">
                  <div
                    class="object-icon"
                    :class="'category-' + selectedNode.category"
                  >
                    <app-icon :name="nodeIcon(selectedNode)" :size="23" />
                  </div>
                  <div>
                    <span>{{ categoryLabel(selectedNode.category) }}</span>
                    <h3 :title="selectedNode.label">
                      {{ selectedNode.label || selectedNode.tag }}
                    </h3>
                    <small>{{ selectedNode.tag }}</small>
                  </div>
                  <button
                    class="icon-button small"
                    title="取消选择"
                    aria-label="取消选择"
                    @click="selectNode(null)"
                  >
                    <app-icon name="x" :size="14" />
                  </button>
                </div>
                <div class="inspector-tabs">
                  <button
                    :class="{ active: detailTab === 'properties' }"
                    @click="detailTab = 'properties'"
                  >
                    属性<span>{{ attributeCount }}</span></button
                  ><button
                    :class="{ active: detailTab === 'xml' }"
                    @click="detailTab = 'xml'"
                  >
                    XML</button
                  ><button
                    :class="{ active: detailTab === 'connections' }"
                    @click="detailTab = 'connections'"
                  >
                    连接<span>{{ selectedConnections.length }}</span>
                  </button>
                </div>
                <div class="inspector-scroll">
                  <template v-if="detailTab === 'properties'">
                    <div class="detail-section">
                      <div class="section-title">
                        标识信息<button
                          class="icon-button small"
                          title="复制对象 ID"
                          aria-label="复制对象 ID"
                          @click="
                            copyText(selectedNode.xmlId || selectedNode.id)
                          "
                        >
                          <app-icon name="copy" :size="13" />
                        </button>
                      </div>
                      <table class="properties-table" aria-label="标识信息">
                        <thead><tr><th scope="col">属性</th><th scope="col">属性值</th></tr></thead>
                        <tbody>
                        <tr>
                          <th scope="row">对象 ID</th>
                          <td class="mono">
                            {{ selectedNode.xmlId || selectedNode.id }}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">XML 类型</th>
                          <td class="mono">{{ selectedNode.tag }}</td>
                        </tr>
                        <tr v-if="selectedParent">
                          <th scope="row">父级节点</th>
                          <td>
                            <button
                              class="property-link"
                              @click="selectNode(selectedParent.id)"
                            >
                              {{ selectedParent.label || selectedParent.tag
                              }}<app-icon name="arrow-up-right" :size="12" />
                            </button>
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">直接子节点</th>
                          <td>{{ selectedNode.childIds.length }}</td>
                        </tr>
                      </tbody>
                      </table>
                    </div>
                    <div class="detail-section">
                      <div class="section-title">
                        XML 属性<span class="section-count">{{
                          Object.keys(selectedNode.attributes).length
                        }}</span>
                      </div>
                      <table class="properties-table" aria-label="XML 属性">
                        <thead><tr><th scope="col">属性</th><th scope="col">属性值</th></tr></thead>
                        <tbody>
                        <tr
                          v-for="(value, key) in selectedNode.attributes"
                          :key="key"
                        >
                          <th scope="row">{{ key }}</th>
                          <td>{{ value || "—" }}</td>
                        </tr>
                      </tbody>
                      </table>
                      <p
                        v-if="!Object.keys(selectedNode.attributes).length"
                        class="muted-note"
                      >
                        该节点没有 XML 属性。
                      </p>
                    </div>
                    <div
                      v-if="selectedNode.properties.length"
                      class="detail-section"
                    >
                      <div class="section-title">
                        工程属性<span class="section-count">{{
                          selectedNode.properties.length
                        }}</span>
                      </div>
                      <table class="properties-table" aria-label="工程属性">
                        <thead><tr><th scope="col">属性</th><th scope="col">属性值</th></tr></thead>
                        <tbody>
                        <tr
                          v-for="(property, index) in selectedNode.properties"
                          :key="index"
                        >
                          <th scope="row" :title="property.source">{{ property.name }}</th>
                          <td>
                            {{ property.value || "—" }}
                            <span class="property-unit">{{
                              property.unit
                            }}</span>
                          </td>
                        </tr>
                      </tbody>
                      </table>
                    </div>
                    <div v-if="selectedNode.text" class="detail-section">
                      <div class="section-title">文本内容</div>
                      <p class="node-text">{{ selectedNode.text }}</p>
                    </div>
                    <div class="detail-section">
                      <div class="section-title">节点路径</div>
                      <div class="node-path">
                        <button
                          v-for="(part, index) in selectedPath"
                          :key="part.id"
                          @click="selectNode(part.id)"
                        >
                          <app-icon
                            v-if="index"
                            name="chevron-right"
                            :size="12"
                          />{{ part.tag }}
                        </button>
                      </div>
                    </div>
                  </template>
                  <template v-if="detailTab === 'xml'"
                    ><div class="xml-toolbar">
                      <span>原始节点 XML</span
                      ><button
                        class="icon-button small"
                        title="复制 XML"
                        aria-label="复制 XML"
                        @click="copyText(selectedXml)"
                      >
                        <app-icon name="copy" :size="14" />
                      </button>
                    </div>
                    <pre class="xml-code">{{ selectedXml }}</pre>
                  </template>
                  <template v-if="detailTab === 'connections'"
                    ><div class="connections-header">直接引用与管线连接</div>
                    <button
                      v-for="(connection, index) in selectedConnections"
                      :key="index"
                      class="connection-card"
                      @click="selectNode(connection.target)"
                    >
                      <span
                        ><app-icon name="git-branch" :size="15" />{{
                          connection.kind
                        }}</span
                      ><strong>{{
                        nodeMap[connection.target]
                          ? nodeMap[connection.target].label
                          : connection.target || "未解析的目标"
                      }}</strong
                      ><small
                        >{{ connection.from }} → {{ connection.to }}</small
                      >
                    </button>
                    <div
                      v-if="!selectedConnections.length"
                      class="empty-inspector"
                    >
                      <app-icon name="git-branch" :size="28" /><strong
                        >暂无直接连接记录</strong
                      >
                      <p>连接通过 XML 中的引用 ID 解析。</p>
                    </div></template
                  >
                </div>
                <div class="inspector-footer">
                  <button
                    class="button locate-button"
                    @click="focusNode(selectedId)"
                  >
                    <app-icon name="crosshair" :size="15" />在画布中定位<kbd
                      >F</kbd
                    >
                  </button>
                </div>
              </div>
              <div v-else class="file-overview">
                <div class="overview-art">
                  <app-icon name="mouse-pointer-2" :size="27" /><span
                    class="art-corner one"
                  ></span
                  ><span class="art-corner two"></span>
                </div>
                <h3>探索图纸中的对象</h3>
                <p>
                  点击画布或模型树中的节点，<br />查看层级、工程属性和连接关系。
                </p>
                <div v-if="model" class="overview-metrics">
                  <div>
                    <span>XML 节点</span
                    ><b>{{ stats.nodeCount.toLocaleString() }}</b>
                  </div>
                  <div>
                    <span>图形元素</span
                    ><b>{{ model.primitives.length.toLocaleString() }}</b>
                  </div>
                  <div>
                    <span>连接关系</span><b>{{ model.connections.length }}</b>
                  </div>
                  <div>
                    <span>解析耗时</span><b>{{ parseTime }} ms</b>
                  </div>
                </div>
                <button class="button secondary" @click="selectFirstEquipment">
                  查看第一个设备<app-icon name="arrow-right" :size="15" />
                </button>
              </div>
            </aside>
          </div>
          <footer class="status-bar">
            <div>
              <span class="status-indicator"></span
              >{{ loading ? "正在加载" : model ? "解析完成" : "等待文件"
              }}<span class="status-divider">|</span
              ><span
                >{{
                  stats.nodeCount ? stats.nodeCount.toLocaleString() : 0
                }}
                个节点</span
              ><span class="status-divider">·</span
              ><span
                >{{
                  model ? model.primitives.length.toLocaleString() : 0
                }}
                个图形</span
              >
            </div>
            <div>
              <button
                v-if="model"
                class="warning-button"
                :class="{ hasWarning: model.warnings.length }"
                @click="showWarnings = true"
              >
                <app-icon
                  :name="
                    model.warnings.length ? 'circle-alert' : 'circle-check'
                  "
                  :size="13"
                />{{
                  model.warnings.length
                    ? model.warnings.length + " 条解析提示"
                    : "无解析异常"
                }}</button
              ><span class="status-divider">|</span><span>Three.js / WebGL</span
              ><span class="status-divider">|</span><span>UTF-8</span>
            </div>
          </footer>
        </section>
        <div class="workspace-footer">
          <span>DEXPI 标准工程数据 · 让流程清晰可见</span
          ><span
            >Vue 2 + Three.js
            <span class="footer-dot">•</span> 本地离线可用</span
          >
        </div>
      </main>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".xml,.dexpi,application/xml,text/xml"
      class="hidden-input"
      @change="onFileChange"
    />
    <div v-if="dragging" class="drop-overlay">
      <app-icon name="upload" :size="42" />
      <h2>松开以导入 DEXPI XML</h2>
      <p>文件仅在当前浏览器中解析</p>
    </div>
    <div v-if="toast" class="toast" :class="toast.type" role="status">
      <app-icon
        :name="toast.type === 'error' ? 'circle-alert' : 'circle-check'"
        :size="18"
      /><span>{{ toast.message }}</span
      ><button
        class="icon-button small"
        aria-label="关闭通知"
        @click="toast = null"
      >
        <app-icon name="x" :size="14" />
      </button>
    </div>
    <div
      v-if="showSamples || showHelp || showAbout || showWarnings"
      class="modal-backdrop"
      @click.self="closeModals"
    >
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-label="
          showSamples
            ? '示例文件库'
            : showHelp
              ? '使用帮助'
              : showAbout
                ? '数据来源与格式支持'
                : '解析报告'
        "
      >
        <div class="modal-heading">
          <span class="eyebrow">{{
            showSamples
              ? "SAMPLE LIBRARY"
              : showHelp
                ? "GETTING STARTED"
                : showAbout
                  ? "ABOUT THE VIEWER"
                  : "PARSING REPORT"
          }}</span
          ><button
            class="icon-button"
            aria-label="关闭弹窗"
            @click="closeModals"
          >
            <app-icon name="x" />
          </button>
        </div>
        <template v-if="showSamples"
          ><h2>从一张真实图纸开始</h2>
          <p class="modal-intro">已下载的公开 DEXPI 数据，可直接打开探索。</p>
          <button
            v-for="sample in samples"
            :key="sample.id"
            class="sample-card"
            :disabled="loading"
            @click="loadSample(sample)"
          >
            <span class="sample-icon"
              ><app-icon name="network" :size="26" /></span
            ><span class="sample-copy"
              ><strong>{{ sample.name }}</strong
              ><small>{{ sample.description }}</small
              ><span>{{ sample.file }}</span></span
            ><app-icon name="arrow-up-right" :size="20" />
          </button>
          <p class="modal-footnote">
            样例来源和许可说明保存在项目 docs/data-sources.md 中。
          </p></template
        >
        <template v-else-if="showHelp"
          ><h2>轻松探索 P&ID</h2>
          <p class="modal-intro">
            导入 XML 后，模型树、图纸和属性面板将同步联动。
          </p>
          <div class="help-row">
            <span>选择对象 / 查看属性</span><b>单击图形或树节点</b>
          </div>
          <div class="help-row">
            <span>平移 / 缩放画布</span><b>拖动 / 滚轮</b>
          </div>
          <div class="help-row"><span>定位所选对象</span><kbd>F</kbd></div>
          <div class="help-row"><span>查看完整图纸</span><kbd>Home</kbd></div>
          <div class="help-row"><span>搜索节点</span><kbd>/</kbd></div>
          <div class="help-row">
            <span>取消选择 / 关闭弹窗</span><kbd>Esc</kbd>
          </div>
          <p class="modal-footnote">
            也可以将 XML 文件直接拖入工作台。工程属性值按源文件展示。
          </p></template
        >
        <template v-else-if="showAbout"
          ><h2>数据可追溯，图纸可探索</h2>
          <p class="modal-intro">
            Vue 2.7 + Three.js 构建的本地 DEXPI XML 查看器。
          </p>
          <div class="about-block">
            <h3>格式支持</h3>
            <p>
              支持基于 Proteus XML 的 DEXPI 1.x
              文件，解析节点、通用属性、连接引用及线段、圆弧、符号库等图形。DEXPI
              2.0 原生 XML 仅提供层级和属性浏览，图形映射暂不支持。本工具不执行
              XSD 合规校验。
            </p>
          </div>
          <div class="about-block">
            <h3>真实数据与图标</h3>
            <p>
              内置公开 DEXPI 测试数据，原始 XML
              和来源说明一同保存在项目中。界面使用本地 Lucide SVG 图标。
            </p>
            <a
              href="https://github.com/DEXPI/TestCases"
              target="_blank"
              rel="noreferrer"
              >DEXPI TestCases<app-icon name="external-link" :size="13" /></a
            ><a
              href="https://github.com/process-intelligence-research/pyDEXPI"
              target="_blank"
              rel="noreferrer"
              >pyDEXPI<app-icon name="external-link" :size="13"
            /></a></div
        ></template>
        <template v-else
          ><h2>解析报告</h2>
          <p class="modal-intro">{{ fileName }} · {{ parseTime }} ms</p>
          <div v-if="model && !model.warnings.length" class="report-success">
            <app-icon name="circle-check" :size="27" /><strong
              >未发现解析异常</strong
            >
            <p>
              已完成 XML 结构、图形与连接引用解析。此结果不等同于 XSD
              标准合规认证。
            </p>
          </div>
          <ul v-else class="warnings-list">
            <li
              v-for="(warning, index) in model ? model.warnings : []"
              :key="index"
            >
              {{
                typeof warning === "string"
                  ? warning
                  : warning.message || warning
              }}
            </li>
          </ul></template
        >
      </section>
    </div>
  </div>
</template>

<script>
import AppIcon from "./components/AppIcon.vue";
import { parseDexpi } from "./lib/dexpi-parser.js";
import { DiagramRenderer } from "./lib/diagram-renderer.js";
import { createSelectionNodes } from "./lib/primitive-selection.js";

const CATEGORY_LABELS = {
  equipment: "设备",
  piping: "管道与管件",
  instrumentation: "仪表",
  drawing: "图纸与标注",
  metadata: "元数据",
  other: "模型节点",
};
const CATEGORY_ICONS = {
  equipment: "box",
  piping: "git-branch",
  instrumentation: "gauge",
  drawing: "file",
  metadata: "braces",
  other: "folder",
};
const SEMANTIC_TAGS =
  /^(PlantModel|Model|Drawing|Equipment|Nozzle|PipingNetworkSystem|PipingNetworkSegment|PipingComponent|ProcessInstrument|InstrumentationLoopFunction|ProcessInstrumentationFunction|Actuating.*|ProcessSignal.*|InformationFlow|InstrumentConnection|PlantArea|PlantInformation|MetaData|MetaInformation|Association|Component|PipeConnectorSymbol|SignalConnectorSymbol)$/;

export default {
  components: { AppIcon },
  data() {
    return {
      model: null,
      nodeMap: Object.freeze({}),
      selectionNodes: Object.freeze([]),
      fileName: "",
      xmlText: "",
      samples: [],
      activeSample: null,
      loading: false,
      parseTime: 0,
      selectedId: null,
      query: "",
      treeMode: "model",
      modelHidden: false,
      inspectorOpen: false,
      expanded: {},
      leftPanel: "tree",
      detailTab: "properties",
      grid: true,
      labels: true,
      view: { zoom: 100, center: { x: 0, y: 0 } },
      canvasError: "",
      exportMenu: false,
      showSamples: false,
      showHelp: false,
      showAbout: false,
      showWarnings: false,
      dragging: false,
      toast: null,
      layers: {
        equipment: true,
        piping: true,
        instrumentation: true,
        drawing: true,
        metadata: true,
        other: true,
      },
      layerOptions: [
        { id: "equipment", label: "设备与喷嘴", icon: "box" },
        { id: "piping", label: "管线与管件", icon: "git-branch" },
        { id: "instrumentation", label: "仪表与信号", icon: "gauge" },
        { id: "drawing", label: "图框与标注", icon: "file" },
        { id: "metadata", label: "元数据图形", icon: "braces" },
        { id: "other", label: "其他对象", icon: "layers" },
      ],
    };
  },
  computed: {
    stats() {
      return this.model ? this.model.stats : {};
    },
    selectedNode() {
      return this.nodeMap[this.selectedId] || null;
    },
    selectedParent() {
      return this.selectedNode
        ? this.nodeMap[this.selectedNode.parentId]
        : null;
    },
    attributeCount() {
      return this.selectedNode
        ? Object.keys(this.selectedNode.attributes).length +
            this.selectedNode.properties.length
        : 0;
    },
    selectedPath() {
      const path = [];
      let node = this.selectedNode;
      while (node) {
        path.unshift(node);
        node = this.nodeMap[node.parentId];
      }
      return path;
    },
    selectedXml() {
      if (!this.selectedNode) return "";
      if (this.model.getNodeXml)
        return this.model.getNodeXml(this.selectedNode.sourceNodeId || this.selectedId);
      return (
        this.selectedNode.sourceXml ||
        this.selectedNode.xml ||
        "<!-- 此节点未提供 XML 源码 -->"
      );
    },
    selectedConnections() {
      if (!this.model || !this.selectedId) return [];
      return this.model.connections
        .filter((c) => c.from === this.selectedId || c.to === this.selectedId)
        .map((c) => ({
          ...c,
          target: c.from === this.selectedId ? c.to : c.from,
          kind: c.type || c.kind || "连接引用",
        }));
    },
    treeData() {
      if (!this.model)
        return { entries: [], children: {}, parents: {}, roots: [] };
      const entries = [],
        children = {},
        parents = {},
        included = new Set(),
        catalogue = new Set();
      const drawnSources = new Set(this.model.primitives.map(p => p.sourceNodeId));
      for (const node of this.selectionNodes) {
        if (node.tag === "ShapeCatalogue" || catalogue.has(node.parentId))
          catalogue.add(node.id);
        if (
          this.treeMode === "xml" ||
          (!catalogue.has(node.id) &&
            (node.id === this.model.rootId ||
              SEMANTIC_TAGS.test(node.tag) ||
              node.tag === "Label" || drawnSources.has(node.id) || node.isPrimitiveInstance ||
              (node.xmlId &&
                ["equipment", "piping", "instrumentation"].includes(
                  node.category,
                ))))
        ) {
          entries.push(node);
          included.add(node.id);
        }
      }
      const roots = [];
      for (const node of entries) {
        let p = node.parentId;
        while (p && !included.has(p)) p = this.nodeMap[p]?.parentId;
        parents[node.id] = p || null;
        if (p) (children[p] || (children[p] = [])).push(node.id);
        else roots.push(node.id);
      }
      return { entries, children, parents, roots };
    },
    searchMatches() {
      if (!this.query.trim()) return null;
      const q = this.query.trim().toLowerCase();
      const matches = new Set();
      for (const node of this.treeData.entries) {
        if (
          (
            node.label +
            " " +
            node.xmlId +
            " " +
            node.tag +
            " " +
            Object.values(node.attributes).join(" ")
          )
            .toLowerCase()
            .includes(q)
        ) {
          let id = node.id;
          while (id && !matches.has(id)) {
            matches.add(id);
            id = this.treeData.parents[id];
          }
        }
      }
      return matches;
    },
    visibleRows() {
      const rows = [];
      const { children, roots } = this.treeData;
      const visit = (id, depth) => {
        if (
          rows.length >= 1000 ||
          (this.searchMatches && !this.searchMatches.has(id))
        )
          return;
        const list = children[id] || [];
        rows.push({
          node: this.nodeMap[id],
          depth,
          hasChildren: !!list.length,
          childCount: list.length,
        });
        if (this.isExpanded(id))
          list.forEach((child) => visit(child, depth + 1));
      };
      roots.forEach((id) => visit(id, 0));
      return rows;
    },
  },
  async mounted() {
    try {
      this.renderer = new DiagramRenderer(this.$refs.canvas, {
        onSelect: (id) => this.selectNode(id),
        onViewChange: (state) => {
          this.view = state;
        },
        onError: (message) => {
          this.canvasError = String(message);
        },
      });
    } catch (error) {
      this.canvasError = error.message;
    }
    window.addEventListener("keydown", this.onKeydown);
    try {
      const response = await fetch("/samples/manifest.json");
      if (!response.ok) throw new Error("无法加载示例文件清单");
      this.samples = await response.json();
      if (this.samples.length) await this.loadSample(this.samples[0]);
    } catch (error) {
      this.notify(error.message, "error");
    }
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKeydown);
    this.renderer?.dispose();
    clearTimeout(this.toastTimer);
  },
  methods: {
    categoryLabel(category) {
      return CATEGORY_LABELS[category] || "模型节点";
    },
    nodeIcon(node) {
      return node.id === this.model?.rootId
        ? "database"
        : CATEGORY_ICONS[node.category] || "folder";
    },
    treeLabel(node) {
      if (node.isPrimitiveInstance) return "图元实例 · " + node.label;
      return node.tag === "Text" ? "Text · " + node.label : node.label || node.tag;
    },
    notify(message, type = "success") {
      clearTimeout(this.toastTimer);
      this.toast = { message, type };
      this.toastTimer = setTimeout(
        () => (this.toast = null),
        type === "error" ? 9000 : 3500,
      );
    },
    closeModals() {
      this.showSamples = false;
      this.showHelp = false;
      this.showAbout = false;
      this.showWarnings = false;
    },
    async loadSample(sample) {
      this.closeModals();
      this.loading = true;
      try {
        const response = await fetch(
          "/samples/" + encodeURIComponent(sample.file),
        );
        if (!response.ok) throw new Error("示例文件加载失败");
        await this.applyXml(await response.text(), sample.file, sample);
      } catch (error) {
        this.notify(error.message, "error");
      } finally {
        this.loading = false;
      }
    },
    async applyXml(xml, fileName, sample = null) {
      await new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0)),
      );
      const started = performance.now();
      const parsed = parseDexpi(xml, { fileName });
      const elapsed = Math.round(performance.now() - started);
      if (!parsed.nodes.length) throw new Error("XML 没有可读取的节点");
      // Freeze the parser model: Vue must not recursively observe tens of thousands of XML nodes.
      this.model = Object.freeze(parsed);
      this.selectionNodes = Object.freeze(createSelectionNodes(parsed));
      this.nodeMap = Object.freeze(
        Object.fromEntries(this.selectionNodes.map((n) => [n.id, n])),
      );
      this.fileName = fileName;
      this.xmlText = xml;
      this.activeSample = sample;
      this.parseTime = elapsed;
      this.selectedId = null;
      this.query = "";
      this.expanded = { [parsed.rootId]: true };
      this.detailTab = "properties";
      for (const id of parsed.nodes.find((n) => n.id === parsed.rootId)
        ?.childIds || []) {
        const n = this.nodeMap[id];
        if (n && /^(PlantArea|PipingNetworkSystem|Drawing)$/.test(n.tag))
          this.$set(this.expanded, id, true);
      }
      if (this.renderer) {
        try {
          this.renderer.setModel(parsed);
          this.renderer.setLayers(this.layers);
          this.renderer.setGrid(this.grid);
          this.renderer.setLabels(this.labels);
          this.canvasError = "";
        } catch (error) {
          this.canvasError = error.message;
          this.notify("XML 已解析，图形渲染失败：" + error.message, "error");
        }
      }
      this.notify(
        "已解析 " +
          parsed.nodes.length.toLocaleString() +
          " 个节点与 " +
          parsed.primitives.length.toLocaleString() +
          " 个图形",
      );
    },
    async readFile(file) {
      if (!file) return;
      if (file.size > 30 * 1024 * 1024) {
        this.notify("文件超过 30 MB，请选择较小的 XML 文件。", "error");
        return;
      }
      this.loading = true;
      try {
        const buffer = await file.arrayBuffer();
        let text = new TextDecoder("utf-8").decode(buffer);
        const encoding = text
          .slice(0, 180)
          .match(/encoding\s*=\s*["']([^"']+)/i)?.[1];
        if (encoding && !/^utf-?8$/i.test(encoding)) {
          try {
            text = new TextDecoder(encoding).decode(buffer);
          } catch {
            throw new Error("无法读取文件编码：" + encoding);
          }
        }
        await this.applyXml(text, file.name);
      } catch (error) {
        this.notify("导入失败：" + error.message, "error");
      } finally {
        this.loading = false;
      }
    },
    onFileChange(event) {
      this.readFile(event.target.files[0]);
      event.target.value = "";
    },
    onDrop(event) {
      this.dragging = false;
      this.readFile(event.dataTransfer.files[0]);
    },
    onDragLeave(event) {
      if (!event.relatedTarget || !this.$el.contains(event.relatedTarget))
        this.dragging = false;
    },
    isExpanded(id) {
      return !!this.searchMatches || !!this.expanded[id];
    },
    toggleNode(id) {
      if (this.expanded[id]) this.$delete(this.expanded, id);
      else this.$set(this.expanded, id, true);
    },
    expandNode(id) {
      this.$set(this.expanded, id, true);
    },
    collapseTree() {
      this.expanded = {};
    },
    changeTreeMode(mode) {
      this.treeMode = mode;
      this.expanded = { [this.model?.rootId]: true };
      if (this.selectedId) this.revealNode(this.selectedId);
    },
    revealNode(id) {
      let p = this.treeData.parents[id];
      while (p) {
        this.$set(this.expanded, p, true);
        p = this.treeData.parents[p];
      }
    },
    selectNode(id) {
      if (id && !this.nodeMap[id]) return;
      this.selectedId = id;
      this.renderer?.select(id);
      if (id) {
        if (this.searchMatches && !this.searchMatches.has(id)) this.query = "";
        if (window.innerWidth <= 1100) this.inspectorOpen = true;
        this.revealNode(id);
        this.$nextTick(() => {
          const el = this.$el.querySelector(
            '[data-node-id="' + CSS.escape(id) + '"]',
          );
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
    },
    selectFirstEquipment() {
      const node = this.model?.nodes.find(
        (n) =>
          n.tag === "Equipment" && n.xmlId && this.treeData.entries.includes(n),
      );
      if (node) this.selectNode(node.id);
    },
    focusNode(id) {
      if (!id) return;
      const result = this.renderer?.focus(id);
      if (result === false) this.notify("此节点没有可定位的图形。", "error");
    },
    fit() {
      this.renderer?.fit();
    },
    zoomBy(factor) {
      this.renderer?.zoomBy(factor);
    },
    toggleGrid() {
      this.grid = !this.grid;
      this.renderer?.setGrid(this.grid);
    },
    toggleLabels() {
      this.labels = !this.labels;
      this.renderer?.setLabels(this.labels);
    },
    toggleLayer(id) {
      this.$set(this.layers, id, !this.layers[id]);
      this.renderer?.setLayers(this.layers);
    },
    download(data, name, type) {
      const blob = data instanceof Blob ? data : new Blob([data], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.exportMenu = false;
    },
    exportJson() {
      if (!this.model) return;
      const {
        name,
        version,
        format,
        rootId,
        nodes,
        primitives,
        connections,
        bounds,
        stats,
        warnings,
      } = this.model;
      this.download(
        JSON.stringify(
          {
            name,
            version,
            format,
            rootId,
            nodes,
            primitives,
            connections,
            bounds,
            stats,
            warnings,
          },
          null,
          2,
        ),
        this.fileName.replace(/\.[^.]+$/, "") + ".json",
        "application/json",
      );
    },
    exportXml() {
      this.download(this.xmlText, this.fileName, "application/xml");
    },
    exportPng() {
      try {
        const url = this.renderer?.exportPng();
        if (!url) throw new Error("画布不可用");
        const link = document.createElement("a");
        link.href = url;
        link.download = this.fileName.replace(/\.[^.]+$/, "") + ".png";
        link.click();
        this.exportMenu = false;
        this.notify("当前画布已导出为 PNG");
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        this.notify("已复制到剪贴板");
      } catch {
        this.notify("无法访问剪贴板，请手动选择复制。", "error");
      }
    },
    onKeydown(event) {
      if (event.key === "Escape") {
        this.closeModals();
        this.exportMenu = false;
        this.selectNode(null);
        return;
      }
      if (
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key === "/") {
        event.preventDefault();
        this.leftPanel = "tree";
        this.$nextTick(() => this.$refs.searchInput?.focus());
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        this.focusNode(this.selectedId);
      } else if (event.key === "Home") {
        event.preventDefault();
        this.fit();
      } else if (event.key === "+" || event.key === "=") this.zoomBy(1.25);
      else if (event.key === "-") this.zoomBy(0.8);
    },
  },
};
</script>
