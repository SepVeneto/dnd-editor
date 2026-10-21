<template>
  <div
    class="mpd-node mpd-relative"
    :data-id="node.wid"
    :style="normalizeStyle(node.style)"
    :data-name="node.name"
    :class="[
      isActive && 'selected',
      isDraggable && 'draggable',
      isHover && 'hover',
      preview && 'preview',
    ]"
  >
    <div
      class="node-wrap"
      @mouseenter.stop="editor.hovering = node.wid"
      @mouseleave.stop="editor.hovering = undefined"
      @click.stop="handleSelect"
    >
      <NodeContainer
        v-if="node.type === 'containerGrid'"
        :data-id="node.wid"
        :node="node"
      />
      <slot v-else>
        <div>拖曳组件</div>
      </slot>
    </div>
    <NodeOperate
      v-if="isActive && !preview"
      :node="node"
    />

    <div
      v-if="node.visible === false"
      class="hidden-mask mpd-absolute mpd-left-0 mpd-top-0 mpd-right-0 mpd-bottom-0 mpd-pointer-events-none mpd-flex mpd-justify-center mpd-items-center"
      style="background: #33333333"
    >
      <ElIcon :size="48">
        <IconHide />
      </ElIcon>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import { Hide as IconHide } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { computed } from 'vue'
import { useEditor } from '@/store'
import { normalizeStyle } from '@/utils'
import NodeContainer from './NodeContainer.vue'
import NodeOperate from './NodeOperate.vue'

const props = defineProps<{
  node: Node
  preview?: boolean
  /** 覆盖节点选中态。固定组件预览由配置页的激活状态决定。 */
  active?: boolean
  /**
   * 覆盖默认选中行为。固定组件预览由编辑器接管时，通常需要选中根节点而不是组件节点。
   */
  select?: (node: Node) => void
}>()

const editor = useEditor()
const preview = computed(() => props.preview === true)
const isActive = computed(() => {
  if (preview.value)
    return props.active === true

  return props.node.wid === editor.selected
})
const isHover = computed(() => {
  if (isActive.value)
    return false

  return props.node.wid === editor.hovering
})
const isDraggable = computed(() => props.node.widget?.draggable)

function handleSelect() {
  if (props.select)
    props.select(props.node)
  else
    editor.selectNode(props.node.wid)
}
</script>

<style lang="scss" scoped>
.mpd-node {
  &.draggable {
    cursor: grab;
    &:active {
      cursor: grabbing;
    }
  }
  &.selected::after {
    border: 1px solid #4089Ef;
  }
  &.hover::after {
    border: 1px dashed #4089Ef;
  }
  &.preview.hover::before {
    display: none;
  }
  &.hover::before {
    content: attr(data-name);
    position: absolute;
    top: 0;
    // transform: translateY(100%);
    font-size: 14px;
    z-index: 1;
    color: #fff;
    background: #4089Ef;
    padding: 4px;
    z-index: 1;
  }
  &::after {
    content: '';
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    pointer-events: none;
    z-index: 1;
  }
}
.node-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: inherit;
  cursor: default;
  // &.mask::after {
  //   pointer-events: auto;
  // }
}
</style>
