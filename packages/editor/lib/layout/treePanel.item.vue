<template>
  <li
    v-if="!node.hasList && !node.isContainer"
    class="mpd-list-none tree-item"
    :class="[node.dragging && 'dragging']"
  >
    <span
      :style="`margin-left: ${node.level * 20}px`"
      class="tree-node-content"
    >
      <IconItem class="node-icon" />
      {{ node.name }}
    </span>
  </li>
  <div
    v-else
    class="tree-wrap"
    :class="[node.dragging && 'dragging']"
  >
    <ul
      :style="`margin-left: ${node.level * 20}px`"
      class="tree-node-list"
    >
      <li class="tree-node-header">
        <span class="tree-node-content">
          <IconContainer class="node-icon folder-icon" />
          {{ node.name }}
        </span>
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
        @end="editor.dragging = null"
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
import IconContainer from '@/assets/container.vue'
import IconItem from '@/assets/puzzle.vue'
import { useEditor } from '@/store'
// eslint-disable-next-line import/no-self-import
import TreePanelItem from './treePanel.item.vue'

const props = defineProps<{ node: Node }>()

const editor = useEditor()
function onAdd(evt: DraggableEvt) {
  const list = [...props.node.list]
  const nextNode = list[evt.newIndex + 1]
  if (nextNode && nextNode.widget.isFixed) {
    const deletedNode = list.splice(0, 1)[0]

    // 跨容器移动触发fixed时需要手动还原到旧容器中
    if (evt.to !== evt.from) {
      const oldContainer = editor.nodeMap.get(evt.from.dataset.id!)!
      ;(oldContainer.list as Node[]).splice(evt.oldIndex, 0, deletedNode)
    }

    onInput(list)
    return
  }
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
    if (wid === val[originIndex].wid) {
      val.splice(originIndex, 1)
    }
    else {
      val.splice(originIndex + 1, 1)
    }
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
.tree-node-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tree-node-header {
  padding: 6px 12px;
  border-radius: 4px;
  margin-bottom: 4px;

  &:hover {
    background-color: #e4e7ed;
  }
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.node-icon {
  font-size: 12px;
  opacity: 0.7;

  &.folder-icon {
    font-size: 16px;
  }
}

.node-container.placeholder {
  min-height: 64px;
  line-height: 64px;
  background-color: #fafafa;
  border-radius: 4px;
  margin: 8px 0;
  border: 1px dashed #dcdfe6;

  &::after {
    content: '放置子节点';
    display: block;
    font-size: 14px;
    color: #909399;
    width: 100%;
    text-align: center;
    font-style: italic;
  }
}

.tree-item {
  height: 36px;
  line-height: 36px;
  padding: 0 12px;
  border-radius: 4px;
  margin-bottom: 2px;
  transition: all 0.2s ease;
  background-color: #ffffff;

  &:hover {
    color: #409eff;
  }

  .tree-node-content {
    color: #606266;
  }
}

.tree-wrap.dragging .placeholder::after {
  color: #ffffff;
  background: #409eff;
}

.tree-item, .tree-wrap {
  margin: 2px 0;
  &.dragging {
    color: #ffffff;
    background: #409eff;

    .tree-node-content {
      color: #ffffff;
    }
  }
}

// 拖拽列表动画
.flip-list-move {
  transition: transform 0.3s ease;
}

.flip-list-enter-active,
.flip-list-leave-active {
  transition: all 0.3s ease;
}

.flip-list-enter-from,
.flip-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 拖拽时的幽灵元素样式 */
.dragging-ghost {
  opacity: 0.7;
  background: #f5f7fa;
  border: 1px dashed #409eff;
  border-radius: 4px;
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
