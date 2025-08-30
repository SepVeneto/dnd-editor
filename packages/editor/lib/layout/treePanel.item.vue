<template>
  <li
    v-if="!node.hasList && !node.isContainer"
    class="mpd-list-none tree-item"
    :class="[node.dragging && 'dragging']"
  >
    <span :style="`margin-left: ${node.level * 20}px`">{{ node.name }}</span>
  </li>
  <div
    v-else
    class="tree-wrap"
    :class="[node.dragging && 'dragging']"
  >
    <ul
      :style="`margin-left: ${node.level * 20}px`"
    >
      <li>
        {{ node.name }}
      </li>
      <Vuedraggable
        class="node-container"
        :class="[!node.hasList && 'placeholder']"
        :model-value="node.list"
        :group="{ name: 'editor', pull: false, put: !node.dragging }"
        :component-data="{ type: 'transition-group', name: 'flip-list' }"
        :animation="200"
        handle=".node-wrap.draggable"
        ghost-class="dragging-ghost"
        item-key="wid"
        @update:model-value="onInput"
        @add="onAdd"
      >
        <template #item="{ element }">
          <TreePanelItem
            :node="element"
          >
            {{ element.name }}
          </TreePanelItem>
        </template>
      </Vuedraggable>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import type { DraggableEvt } from '@/type'
import { nextTick } from 'vue'
import Vuedraggable from 'vuedraggable'
import { useEditor } from '@/store'
// eslint-disable-next-line import/no-self-import
import TreePanelItem from './treePanel.item.vue'

const props = defineProps<{ node: Node }>()

const editor = useEditor()
function onAdd(evt: DraggableEvt) {
  const node = props.node.list[evt.newDraggableIndex]
  node && editor.addNode(node, props.node)
}

function onInput(val: Node[]) {
  if (props.node.list.length === val.length) {
    props.node.setList(val)
  }
  else {
    const wid = findExistWid(val)
    const originIndex = props.node.list.findIndex(node => node.wid === wid)
    if (originIndex === -1) {
      props.node.setList(val)
      return
    }
    // 只处理同级同节点跨组件移动节点消失的情况
    val.splice(originIndex, 1)
    nextTick().then(() => {
      props.node.setList(val)
    })
  }
}

function findExistWid(list: Node[]) {
  const wids: string[] = []
  for (const item of list) {
    const exist = wids.includes(item.wid)
    if (exist) {
      return item.wid
    }
    else {
      wids.push(item.wid)
    }
  }
}
</script>

<style lang="scss" scoped>
.node-container.placeholder {
  min-height: 20px;
  background: #ddd;
  &::after {
    content: '放置子节点';
    display: block;
    font-size: 12px;
    color: #222;
    width: 100%;
    text-align: center;
  }
}
.tree-item, .tree-wrap {
  &.dragging {
    color: #fff;
    background: var(--mpd-color-primary);
  }
}
</style>
