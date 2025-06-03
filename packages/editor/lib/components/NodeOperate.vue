<template>
  <div
    class="node-operate"
    @click.stop
  >
    <ElDropdown
      :teleported="false"
      :persistent="false"
      style="font: 12px;"
      @command="editor.selected = $event"
    >
      <span style="color: #fff;">{{ node.name }}</span>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem
            v-for="item in nodes"
            :key="item.wid"
            :command="item.wid"
          >
            <span>{{ item.name }}</span>
          </ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>

    <div
      class="icon-wrap"
      @click="handleAction('copy')"
      @mouseenter="onMouseenter($event, '复制')"
    >
      <ElIcon>
        <IconCopy />
      </ElIcon>
    </div>

    <div
      class="icon-wrap"
      @click="handleAction('delete')"
      @mouseenter="onMouseenter($event, '删除')"
    >
      <ElIcon>
        <IconDelete />
      </ElIcon>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Node } from '@/class'
import {
  CopyDocument as IconCopy,
  Delete as IconDelete,
} from '@element-plus/icons-vue'
import { computed, getCurrentInstance } from 'vue'
import { useEditor } from '@/store'
import { createPopper } from '@/utils'

const props = defineProps<{
  node: Node
}>()

// const buttonOperate = [
//   { name: '复制', }
// ]

const editor = useEditor()
editor.plugins.forEach((item) => {
  console.log('plugin', item().init())
})
const nodes = computed(() => {
  return editor.selectedNodes.slice(1)
})
const parent: HTMLElement = editor.shadowRoot!.querySelector('.mpd-editor')!
const inst = getCurrentInstance()!
function onMouseenter(evt: Event, content: string) {
  const target = evt.target as HTMLElement
  createPopper(inst.appContext, target, content, parent)
}

function handleAction(action: 'copy' | 'delete') {
  switch (action) {
    case 'copy':
      editor.addNode(props.node.copy(), props.node.parent)
      break
    case 'delete':
      editor.delNode(props.node.wid)
      break
  }
}
</script>

<style lang="scss" scoped>
.node-operate {
  display: flex;
  column-gap: 6px;
  align-items: center;
  right: 0;
  position: absolute;
  background: #4089ef;
  padding: 4px 6px;
  color: #fff;
}
.icon-wrap {
  cursor: pointer;
}
</style>
