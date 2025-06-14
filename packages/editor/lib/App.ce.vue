<template>
  <ElConfigProvider
    :locale="zhCn"
    namespace="mpd"
  >
    <div>{{ editor.selected }}</div>
    <div
      ref="rootRef"
      class="mpd-editor mpd-flex"
    >
      <WidgetsMenu />
      <VueDraggable
        v-model="editor.rootNode.list"
        :group="{ name: 'editor', pull: true, put: true }"
        class=" mpd-relative mpd-bg-gray-100"
        style="width: 375px; min-height: calc(667px - 60px);"
        :component-data="{ type: 'transition-group', name: 'flip-list' }"
        :animation="200"
        ghost-class="dragging-ghost"
        handle=".node-wrap.draggable"
        item-key="wid"
        @add="onAdd"
      >
        <template #item="{ element }">
          <NodeWrap
            :node="element"
          >
            <ViewRender :type="element.type" />
          </NodeWrap>
        </template>
      </VueDraggable>

      <ConfigPanel @click.stop />
    </div>
  </ElConfigProvider>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import type { DraggableEvt } from './type'
// import SettingGlobal from './layout/Setting.global.ce.vue'
// import SettingWidget from './layout/Setting.widget.ce.vue'
// import { useConfig } from './hooks'
import { registerRemotes } from '@module-federation/enhanced/runtime'
import { EditorContext } from '@sepveneto/dnde-core'
// import Editor from '@/layout/editor.ce.vue'
// import widgetWrap from '@/layout/widgetWrap.ce.vue'
// import { tabbarPreview } from '@/layout/tabbar'
// import { computed, onMounted, ref } from 'vue'
// import { useApp } from '@/store'
// import { useRoute, useRouter } from 'vue-router'
// import { ArrowLeftBold } from '@element-plus/icons-vue'
// import type { Mode } from '@/layout/EditorOperate.ce.vue'
// import EditorOperate from '@/layout/EditorOperate.ce.vue'
// @ts-expect-error: no def
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { provide, useTemplateRef, watchEffect } from 'vue'
import VueDraggable from 'vuedraggable'
import NodeWrap from './components/NodeWrap.vue'
import ConfigPanel from './layout/configPanel.vue'
import WidgetsMenu from './layout/widgetsMenu.vue'
import { editorProps } from './props'
import { useEditor } from './store'
import { useApp } from './store/app'
import { loadFromRemote } from './utils'

const props = defineProps(editorProps)

const app = useApp()
const editor = useEditor()

provide(EditorContext, {
  node: editor.selectedNode,
  plugins: editor.plugins,
})

const rootRef = useTemplateRef('rootRef')

// provide(EditorContext, reactive({
//   nodeList: editor.rootNode,
// }))

function onAdd(evt: DraggableEvt) {
  const node = editor.rootNode.list[evt.newDraggableIndex] as Node
  editor.addNode(node)
}

registerRemotes([
  {
    name: 'widgets',
    entry: `${props.remoteUrl}/mf-manifest.json`,
  },
  // TODO: 重构后需要重新验证
  // 必须开启，否则从其它页面切换回编辑器会导致渲染异常
], { force: true })

const ViewRender = loadFromRemote('widgets', 'viewRender')

watchEffect(() => {
  app.setWidgets(props.widgets)
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
</style>
