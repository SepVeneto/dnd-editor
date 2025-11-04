<template>
  <ElConfigProvider
    :locale="zhCn"
    namespace="mpd"
  >
    <div
      ref="rootRef"
      class="mpd-editor mpd-flex mpd-gap-x-2 mpd-justify-between"
    >
      <WidgetsMenu class="mpd-flex-shrink-0" />
      <div class="phone-wrap mpd-relative">
        <img src="./assets/iPhone13.png">
        <ElScrollbar
          height="714px"
          class=" phone-body mpd-scale-100"
          noresize
        >
          <VueDraggable
            v-model="editor.rootNode.list"
            :group="{ name: 'editor', pull: true, put: true }"
            class="mpd-relative mpd-bg-gray-100  mpd-flex mpd-flex-col mpd-items-center"
            style="width: 375px; min-height: 714px;"
            :style="normalizeStyle(editor.rootNode.style)"
            :component-data="{ type: 'transition-group', name: 'flip-list' }"
            :animation="200"
            ghost-class="dragging-ghost"
            handle=".mpd-node.draggable"
            item-key="wid"
            :move="handleMove"
            @start="handelStart"
            @add="onAdd"
            @end="onEnd"
          >
            <template #item="{ element }">
              <NodeWrap
                :node="element"
              >
                <ViewRender
                  :type="element.type"
                  :config="element"
                />
              </NodeWrap>
            </template>
          </VueDraggable>
        </ElScrollbar>
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
  </ElConfigProvider>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import type { DraggableEvt } from './type'
import { editorContextKey, EventEmitter } from '@sepveneto/dnde-core'
// @ts-expect-error: no def
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { getCurrentInstance, onMounted, onUnmounted, provide, useTemplateRef } from 'vue'
import VueDraggable from 'vuedraggable'
import NodeWrap from './components/NodeWrap.vue'
import ConfigPanel from './layout/configPanel.vue'
import TreePanel from './layout/treePanel.vue'
import WidgetsMenu from './layout/widgetsMenu.vue'
import { editorProps } from './props'
import { useEditor } from './store'
import { useApp } from './store/app'
import { loadFromRemote, normalizeStyle } from './utils'

const props = defineProps(editorProps)

const app = useApp()
const editor = useEditor()
const inst = getCurrentInstance()
const bus = new EventEmitter((event: string, ...args: any) => {
  inst?.parent?.emit(event, ...args)
})

const refRoot = useTemplateRef('rootRef')
onMounted(() => {
  editor.elementRoot = refRoot.value!
})

// TODO: 需要优化
// 目前由于mf在引入时force对于web components在不重新导入的情况下没办法再次加载，导致从其它页面切换回来时不会重新加载样式
// 针对常规项目，样式第一次加载时会被挂载到dom上，所以不需要处理重复打开的情况
// 但是 web components中，样式会被挂载到shadow dom中，而重复打开会重新创建shdow dom
// 导致样式丢失
// 未来要么mf兼容web components，要么提供手动清除缓存的方式
// 或者可以从根本上解决，即考虑其它样式加载的方式
onUnmounted(() => {
  Object.keys(window.__GLOBAL_LOADING_REMOTE_ENTRY__).forEach((key) => {
    delete window.__GLOBAL_LOADING_REMOTE_ENTRY__[key]
  })
  // @ts-expect-error: ignore
  delete window[props.name]
})

provide(editorContextKey, {
  node: editor.selectedNode,
  plugins: editor.plugins,
  bus,
  extra: props.extra || {},
})

function onEnd() {
  editor.dragging = null
}
function handleMove(evt: any) {
  // 如果该元素是跨容器拖动，交给目标容器的add事件处理
  if (evt.from !== evt.to)
    return

  const nextNode = editor.rootNode.list[evt.draggedContext.futureIndex]
  if (nextNode && nextNode.widget.isFixed) {
    return false
  }
}
function handelStart(evt: DraggableEvt) {
  const nodeId = evt.item.dataset.id
  const draggingNode = editor.rootNode.list.find((node: any) => node.wid === nodeId)!
  editor.dragging = draggingNode as Node
}
function onAdd(evt: DraggableEvt) {
  const nextNode = editor.rootNode.list[evt.newIndex + 1]
  if (nextNode && nextNode.widget.isFixed) {
    const deletedNode = editor.rootNode.list.splice(0, 1)[0]

    // 跨容器移动触发fixed时需要手动还原到旧容器中
    if (evt.to !== evt.from) {
      const oldContainer = editor.nodeMap.get(evt.from.dataset.id!)!
      ;(oldContainer.list as Node[]).splice(evt.oldIndex, 0, deletedNode)
    }
    return
  }
  const node = editor.rootNode.list[evt.newDraggableIndex] as Node
  editor.addNode(node)
}

const ViewRender = loadFromRemote('widgets', 'viewRender')

app.setWidgets(props.widgets)

const refConfigPanel = useTemplateRef('configPanelRef')
defineExpose({
  validate() {
    return refConfigPanel.value?.validate()
  },
})
</script>

<style lang="scss">
@use './styles/global.scss';
@use 'element-plus/theme-chalk/src/index.scss';
@use '@sepveneto/basic-comp/css';
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
.phone-body {
  position: absolute;
  top: 50px;
  left: 14px;
  right: 14px;
}
</style>
