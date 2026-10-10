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
          <header class="phone-header" v-if="editor.showTopbar">
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
      :capabilities="capabilities"
      :workflows="workflows"
      :context="runtimeContext"
      @init="onInit"
      @edit="onEdit"
      @capability="onCapability"
    />
  </ElConfigProvider>
</template>

<script lang="ts" setup>
import LeftArrow from './assets/leftArrow.vue'
import { Node } from '@sepveneto/dnde-core/class'
import { editorContextKey, EventEmitter } from '@sepveneto/dnde-core'
import { ElConfigProvider, ElScrollbar, provideGlobalConfig } from 'element-plus'
// @ts-expect-error: no def
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { computed, getCurrentInstance, onMounted, onUnmounted, provide, ref, useTemplateRef, watch } from 'vue'
import VueDraggable from 'vuedraggable'
import { useNodeListDrag } from './composables/useNodeListDrag'
import NodeWrap from './components/NodeWrap.vue'
import ConfigPanel from './layout/configPanel.vue'
import TreePanel from './layout/treePanel.vue'
import WidgetsMenu from './layout/widgetsMenu.vue'
import { editorProps } from './props'
import { useApp, useEditor } from './store'
import { EditorKey, loadFromRemote, normalizeStyle } from './utils'
import { snapshotNodes, toLayoutWidgets } from './agents/context'
import { loadAgent } from './agents/loader'
import type { EditIR, LayoutIR } from './agents/types'

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

// 命令式弹层（如 basic-comp 的 createDialog）会在独立的渲染根里渲染，
// 该渲染根只继承 app 级别的 provide，拿不到模板里实例级 <ElConfigProvider> 的命名空间配置，
// 于是会退化成 element-plus 默认的 `el-` 前缀；而编辑器注入的主题是按 `mpd-` 编译的，
// 类名对不上就会让弹窗与其中的 select 下拉完全没有样式。
// 这里把编辑器的命名空间补到 app 级别，让这类弹层也能命中同一份主题。
provideGlobalConfig({ namespace: editorNamespace, locale: zhCn }, inst!.appContext.app)

const capabilities = computed(() => (props.capabilities ?? []) as any[])
const workflows = computed(() => (props.workflows ?? []) as any[])

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

const runtimeContext = () => ({
  widgets: toLayoutWidgets(app.widgets ?? []),
  nodes: snapshotNodes(editor.rootNode.list),
})

function onInit(args: any) {
  const layout = args.detail[0].layout
  layout.forEach((item: any) => {
    const w = app.widgetMap.get(item.widget)
    if (!w)
      return

    const node = new Node(w, JSON.parse(JSON.stringify({ props: w.defaultData, style: w.defaultStyle })))
    // 数据如何写入组件由业务侧通过 widget 的 agent.update 决定
    w.agent?.update?.(node, item, {})

    editor.addNode(node)
  })
}

function onEdit({ edits }: { edits: EditIR[] }) {
  for (const ir of edits) {
    if (ir.type === 'add-component') {
      const w = app.widgetMap.get(ir.widget)
      if (!w)
        continue

      const node = new Node(w, JSON.parse(JSON.stringify({ props: w.defaultData, style: w.defaultStyle })))
      w.agent?.update?.(node, { widget: ir.widget, items: ir.items } as any, {})
      editor.addNode(node)
      continue
    }

    const index = findNodeIndex(ir.target)
    if (index < 0)
      continue

    if (ir.type === 'delete-component') {
      editor.rootNode.list.splice(index, 1)
    }
    else if (ir.type === 'update-component') {
      Object.assign(editor.rootNode.list[index]!.data, ir.changes)
    }
    else if (ir.type === 'move-component') {
      const [node] = editor.rootNode.list.splice(index, 1)
      const before = ir.before ? findNodeIndex(ir.before) : -1
      const after = ir.after ? findNodeIndex(ir.after) : -1
      let insertAt = editor.rootNode.list.length
      if (before >= 0)
        insertAt = before
      else if (after >= 0)
        insertAt = after + 1
      editor.rootNode.list.splice(insertAt, 0, node!)
    }
  }
}

function findNodeIndex(target: string): number {
  const list = editor.rootNode.list
  const numeric = Number.parseInt(target, 10)
  if (!Number.isNaN(numeric) && list[numeric])
    return numeric

  return list.findIndex(node => node.wid === target || node.type === target || node.name === target)
}

function onCapability({ name, result }: { name: string, result: unknown }) {
  // 业务能力结果已经在助手面板里展示，这里不修改编辑器。
  console.log('[editor] capability result', name, result)
}

// TODO: 需要优化
// 目前由于mf在引入时force对于web components在不重新导入的情况下没办法再次加载，导致从其它页面切换回来时不会重新加载样式
// 针对常规项目，样式第一次加载时会被挂载到dom上，所以不需要处理重复打开的情况
// 但是 web components中，样式会被挂载到shadow dom中，而重复打开会重新创建shdow dom
// 导致样式丢失
// 未来要么mf兼容web components，要么提供手动清除缓存的方式
// 或者可以从根本上解决，即考虑其它样式加载的方式
onUnmounted(() => {
  // @ts-expect-error: ignore
  window.__disposeModules()
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
