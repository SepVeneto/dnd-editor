<template>
  <mpd-editor
    ref="editorRef"
    remote-url="http://localhost:8090"
    :widgets="widgets"
  />
</template>

<script setup lang="ts">
import type { IWidget } from '@sepveneto/dnde-core'
import { onMounted, useTemplateRef } from 'vue'
import { register } from '@/main'

const editorRef = useTemplateRef('editorRef')
register()

onMounted(() => {
  editorRef.value?.register(() => ({
    init() {
      console.log('init')
    },
  }))
})

const widgets: IWidget<object>[] = [
  { _name: '菜单', _view: 'menuItem', _schema: 'menuItem', isShow: 0, style: {} },
]
</script>
