<template>
  <ElConfigProvider
    :locale="zhCn"
    :namespace="editorNamespace"
  >
    <div
      ref="rootRef"
      class="mpd-editor mpd-flex mpd-gap-x-2 mpd-justify-between"
    >
      <WidgetsMenu class="mpd-flex-shrink-0" />
      <div class="phone-wrap mpd-relative">
        <img src="./assets/iPhone13.png">
        <div
          class="mpd-flex mpd-flex-col mpd-absolute"
          style="top: 50px; left: 14px; right: 14px; height: 714px;"
        >
          <header
            v-if="editor.showTopbar"
            class="phone-header"
          >
            <LeftArrow />
            <span>顶部导航栏</span>
            <span />
          </header>
          <ElScrollbar
            class="mpd-scale-100 mpd-bg-gray-100"
            noresize
            view-style="height: 100%;"
          >
            <VueDraggable
              v-model="editor.rootNode.list"
              :group="{ name: 'editor', pull: true, put: true }"
              class="mpd-relative  mpd-flex mpd-flex-col mpd-items-center"
              style="width: 375px; min-height: 100%;"
              :style="normalizeStyle(editor.rootNode.style)"
              :component-data="{ type: 'transition-group', name: 'flip-list' }"
              :animation="150"
              ghost-class="dragging-ghost"
              :invert-swap="true"
              :swap-threshold="0.5"
              handle=".mpd-node.draggable"
              item-key="wid"
              :move="handleMove"
              @start="drag.onStart"
              @add="drag.onAdd"
              @end="onEnd"
            >
              <template #item="{ element }">
                <NodeWrap
                  :node="element"
                >
                  <ViewRender
                    scope="widgets"
                    :type="`${element.type}.view`"
                    :config="element"
                    :data="element.data"
                  />
                </NodeWrap>
              </template>
            </VueDraggable>

            <template
              v-for="panel in editor.plugins.config.list"
              :key="panel.wid"
            >
              <!-- 配置页关联的固定组件：不可拖曳/删除，点击后回到根节点并激活对应配置页 -->
              <NodeWrap
                v-if="panel.visible === true"
                :node="panel"
                preview
                :active="editor.activeConfigPane === panel.wid"
                :select="selectConfigPanel"
              >
                <ViewRender
                  scope="widgets"
                  :type="`${panel.type}.view`"
                  :config="panel"
                  :data="panel.data"
                />
              </NodeWrap>
            </template>
          </ElScrollbar>
        </div>
      </div>

      <aside style="width: 500px; border: 1px solid var(--mpd-border-color); padding: 1rem;">
        <ElScrollbar
          noresize
          @click.stop
        >
          <ConfigPanel
            v-show="!editor.dragging"
            ref="configPanelRef"
            @click.stop
          />
          <TreePanel v-show="editor.dragging" />
        </ElScrollbar>
      </aside>
    </div>

    <dnd-agent
      v-if="agentReady"
      :api="agentApi"
      :tools="agentTools"
      :context="runtimeContext"
    />
  </ElConfigProvider>
</template>

<script lang="ts" setup>
import { editorContextKey, EventEmitter } from '@sepveneto/dnde-core'
import { Node } from '@sepveneto/dnde-core/class'
import { ElConfigProvider, ElScrollbar } from 'element-plus'
// @ts-expect-error: no def
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { computed, getCurrentInstance, onMounted, onUnmounted, provide, ref, useTemplateRef, watch } from 'vue'
import VueDraggable from 'vuedraggable'
import { loadAgent } from './agents/loader'
import LeftArrow from './assets/leftArrow.vue'
import NodeWrap from './components/NodeWrap.vue'
import { useNodeListDrag } from './composables/useNodeListDrag'
import ConfigPanel from './layout/configPanel.vue'
import TreePanel from './layout/treePanel.vue'
import WidgetsMenu from './layout/widgetsMenu.vue'
import { editorProps } from './props'
import { useApp, useEditor } from './store'
import { EditorKey, loadFromRemote, normalizeStyle } from './utils'

const props = defineProps(editorProps)

const editorNamespace = 'mpd'
const editor = useEditor()
const app = useApp()
const inst = getCurrentInstance()
const bus = new EventEmitter((event: string, ...args: any) => {
  inst?.parent?.emit(event, ...args)
})

const refRoot = useTemplateRef('rootRef')
onMounted(() => {
  editor.elementRoot = refRoot.value!
})

provide(EditorKey, {
  root: refRoot,
})

// 命令式弹层（如 basic-comp 的 createDialog）只继承 app 级别的 provide，
// 其 Element Plus 配置在 main.ts 安装插件时与默认配置一次性写入，避免重复 provide。

const agentTools = computed(() => props.agentTools ?? [])

const agentApi = computed(() => {
  const hostApi = props.agentApi ?? {}
  return {
    ...hostApi,
    model: {
      ...(hostApi.model ?? {}),
    },
    editor: {
      getCurrentEditor: snapshotEditor,
      getWidgets: listAgentWidgets,
      operateEditor,
      ...(hostApi.editor ?? {}),
    },
  }
})

// agent 是可选能力：只有业务侧显式开启、且能加载到 <dnd-agent> 时才渲染。
// 未安装 @sepveneto/dnde-agent 时由 loadAgent 在控制台给出安装提示。
const agentReady = ref(false)
watch(
  () => props.agent,
  async (enabled) => {
    agentReady.value = enabled ? await loadAgent() : false
  },
  { immediate: true },
)

function runtimeContext() {
  const snapshot = snapshotEditor()
  return {
    ...snapshot,
    widgets: listAgentWidgets(),
  }
}

function serializeAgentNode(node: any): Record<string, any> {
  return {
    id: node.wid,
    type: node.type,
    name: node.name,
    data: node.data,
    style: node.style,
    children: node.list?.map(serializeAgentNode) ?? [],
  }
}

function snapshotEditor() {
  return {
    page: serializeAgentNode(editor.rootNode),
    selected: editor.selected,
  }
}

function listAgentWidgets() {
  return app.widgetsFlat.map((item) => {
    const schema = item._data.schema ?? {}
    return {
      typeId: item.view,
      name: item.name,
      description: item.agent?.description ?? item.agent?.layout?.description ?? '',
      defaultData: item.defaultData,
      defaultStyle: item.defaultStyle,
      propsSchema: schema.props ?? [],
      styleSchema: schema.style ?? [],
    }
  })
}

function requireAgentNode(id: string | undefined) {
  const node = id ? editor.nodeMap.get(id) : undefined
  if (!node)
    throw new Error(`找不到节点 ${id ?? ''}`)
  return node
}

function operateEditor(operation: Record<string, any>) {
  if (operation.action === 'add') {
    const widget = app.widgetMap.get(operation.widget)
    if (!widget)
      throw new Error(`找不到组件 ${operation.widget ?? ''}`)

    const parent = operation.target
      ? requireAgentNode(operation.target)
      : editor.rootNode
    // eslint-disable-next-line ts/ban-ts-comment
    // @ts-ignore
    const node = new Node(widget, JSON.parse(JSON.stringify({
      props: widget.defaultData,
      style: widget.defaultStyle,
    })))
    widget.agent?.update?.(node, {
      widget: operation.widget,
      items: operation.items ?? [],
    }, {})
    if (operation.changes)
      Object.assign(node.data, operation.changes)
    if (operation.style)
      Object.assign(node.style, operation.style)
    editor.addNode(node, parent, true)
    editor.selectNode(node.wid)
    return { ok: true, node: serializeAgentNode(node) }
  }

  const node = requireAgentNode(operation.target)

  if (operation.action === 'edit') {
    if (operation.changes)
      Object.assign(node.data, operation.changes)
    if (operation.style)
      Object.assign(node.style, operation.style)
    return { ok: true, node: serializeAgentNode(node) }
  }

  if (operation.action === 'delete') {
    editor.delNode(node.wid)
    return { ok: true, node: { id: node.wid } }
  }

  if (operation.action === 'move') {
    const parent = node.parent
    if (!parent)
      throw new Error('页面根节点不能移动')

    const index = parent.list.findIndex(item => item.wid === node.wid)
    if (index < 0)
      throw new Error(`节点 ${node.wid} 不在父节点中`)
    parent.list.splice(index, 1)

    const before = operation.before
      ? parent.list.findIndex(item => item.wid === operation.before)
      : -1
    const after = operation.after
      ? parent.list.findIndex(item => item.wid === operation.after)
      : -1
    const insertAt = before >= 0
      ? before
      : after >= 0
        ? after + 1
        : parent.list.length
    parent.list.splice(insertAt, 0, node)
    return { ok: true, node: serializeAgentNode(node) }
  }

  throw new Error(`不支持的编辑器操作 ${operation.action}`)
}

// 编辑器卸载时清掉生产者经模块联邦加载的模块缓存，下次挂载重新导入，拿到最新的组件代码。
// shadow root 重建导致的样式丢失由 ./shadowCss 单独兜住（重建时重新投放已加载过的样式），
// 这里不必再依赖「重新导入」来补样式。
onUnmounted(() => {
  // @ts-expect-error: ignore
  window.__disposeModules?.()
  // Object.keys(window.__GLOBAL_LOADING_REMOTE_ENTRY__).forEach((key) => {
  //   delete window.__GLOBAL_LOADING_REMOTE_ENTRY__[key]
  // })
  // if (window[props.name]) {
  //   // @ts-expect-error: ignore
  //   delete window[props.name]
  // }
})

const editorContext = {
  node: editor.selectedNode,
  plugins: editor.plugins,
  bus,
  extra: props.extra || {},
  // 预览态保持响应式，业务组件据此禁用拖拽 / 缩放等编辑交互
  get preview() {
    return editor.isPreview
  },
  // 业务组件的配置对象是按引用共享的，原地修改已能被编辑器的变更监听捕获，
  // 这里保留该钩子，供远端组件显式请求编辑器同步数据
  updateConfig() {},
}
provide(editorContextKey, editorContext)
// 命令式弹层（如 createDialog）在独立渲染根里渲染，只继承 app 级别的 provide，
// 拿不到这里实例级的 provide，组件内的 inject(editorContextKey) 会拿到 undefined，
// 因此再补一份到 app 级别。
inst!.appContext.app.provide(editorContextKey, editorContext)

function onEnd() {
  editor.dragging = null
}
function handleMove(evt: any) {
  // 如果该元素是跨容器拖动，交给目标容器的add事件处理
  if (evt.from !== evt.to)
    return

  const nextNode = editor.rootNode.list[evt.draggedContext.futureIndex]
  const direct = evt.draggedContext.index - evt.draggedContext.futureIndex
  if (direct > 0) {
    // 向上移动
    if (nextNode && nextNode.widget.isFixed === 'header') {
      return false
    }
  }
  else {
    // TODO: 多个容器会有问题
    // 向下移动
    for (let i = evt.draggedContext.futureIndex; i > 0; --i) {
      const node = editor.rootNode.list[i]
      if (!node)
        continue

      if (node.widget.isFixed === 'footer') {
        return false
      }
    }
  }
}
const drag = useNodeListDrag({
  get list() {
    return editor.rootNode.list
  },
  get parent() {
    return editor.rootNode as Node
  },
  setList: list => editor.rootNode.setList(list),
})

const ViewRender = loadFromRemote('widgets', 'remote')

const refConfigPanel = useTemplateRef('configPanelRef')

/**
 * 固定组件是根配置的视图入口，本身不作为独立组件进入编辑态。
 * 点击后选中根节点，并定位到该固定组件对应的配置页。
 */
function selectConfigPanel(panel: Node) {
  editor.selectConfigPane(panel.wid)
}

defineExpose({
  validate() {
    return refConfigPanel.value?.validate()
  },
})
</script>

<style lang="scss">
@use './styles/global.scss';
.top-header {
  background: #fff;
  padding: 0 20px;
  height: 90px;
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}
.mobile-frame {
  --padding-left-x: 14px;
  --padding-right-x: 15px;
  --tabbar-height: 50px;
  --header-height: 44px;
  --safe-bottom: 40px;
  float: left;
  background: url('./assets/iPhone13.png');
  width: 375px;
  height: 720px;
  padding-left: var(--padding-left-x);
  padding-right: var(--padding-right-x);
  padding-top: 50px;
  padding-bottom: var(--safe-bottom);
  box-sizing: content-box;
  background-size: calc(375px + var(--padding-left-x) + var(--padding-right-x)) 100%;
  .mobile-content {
    display: flex;
    flex-direction: column;
    height: inherit;
    background: #f4f5f7;
    border-bottom-left-radius: 18px;
    border-bottom-right-radius: 18px;
  }
  .header {
    flex-shrink: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 375px;
    height: var(--header-height);
    box-sizing: border-box;
    padding: 0 16px;
    font-size: 18px;
    position: relative;
    background: #fff;
    &.hidden {
      background: transparent;
      position: absolute;
    }
    .icon {
      background: url('./assets/4_objects.svg');
      background-size: 100%;
      display: inline-block;
      width: 87px;
      height: 32px;
    }
  }
}
.main-container {
  // display: flex;
  width: 100%;
  // justify-content: space-between;
}
// .mobile-wrapper {
//   padding: 10px;
//   border: 1px solid #222;
//   border-radius: 6px;
// }
.draggable-box {
  min-height: 400px;
}
.phone-wrap > img {
  width: 403px;
}
.phone-header {
  height: 44px;
  flex-shrink: 0;
  background: #fff;
  padding: 7px 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 700;
}
</style>
