<template>
  <mpd-editor
    ref="editorRef"
    remote-url="http://localhost:8090"
    :widgets="widgets"
  >
    <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
    <div slot="helper">
      <button>import</button>
      <button>download</button>
    </div>
  </mpd-editor>
</template>

<script setup lang="ts">
import type { IWidget } from '@sepveneto/dnde-core'
import { Upload as IconUpload } from '@element-plus/icons-vue'
import { h, onMounted, useTemplateRef } from 'vue'
import { register } from '@/main'
// import { register } from '../dist/editor.js'

function test(node: any) {
  console.log('click', node)
}

const editorRef = useTemplateRef('editorRef')
register()

onMounted(() => {
  editorRef.value?.register(ctx => ({
    init() {
      console.log('init', ctx)
      ctx.plugins.helper = [{
        name: 'export',
        title: '导出组件配置',
        action: (node: any) => {
          console.log('export', node)
        },
      }, 'copy', 'delete']
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
