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
import { createCopy, createDelete} from '@sepveneto/dnde-core'
// import { register } from '../dist/editor.js'

const editorRef = useTemplateRef('editorRef')
register()

onMounted(() => {
  editorRef.value?.register(ctx => ({
    init() {
      const copy = createCopy(ctx)
      const del = createDelete(ctx)
      ctx.plugins.helper = [{
        name: 'export',
        title: '导出组件配置',
        action: (node: any) => {
          console.log('export', node)
        },
      }, copy, del]
      // console.log('init')
      // console.log(IconUpload)
      // return h(IconUpload)
    },
  }))
})

const widgets: IWidget<object>[] = [
  { _name: '菜单', _view: 'menuItem', _schema: 'menuItem', isShow: 0, style: {} },
]
</script>
