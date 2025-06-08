<template>
  <div>topbar</div>
  <button @click="handleValid">
    valid
  </button>
  <button @click="handleSet">
    set config
  </button>
  <button @click="handleGet">
    get config
  </button>
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
// import { register } from '../dist/editor.js'

const editorRef = useTemplateRef('editorRef')
register()

onMounted(() => {
  editorRef.value?.register(ctx => ({
    init() {
      // const copy = createCopy(ctx)
      // const del = createDelete(ctx)
      ctx.plugins.helper.addBuiltin({
        name: 'export',
        title: '导出组件配置',
        action: (node: any) => {
          console.log('export', node)
        },
        condition: (node: any) => {
          return true
        },
      })
      // ctx.plugins.helper.addBuiltin({
      //   name: 'delete',
      //   condition: (node: any) => {
      //     return node.type !== 'container'
      //   },
      // })
    },
  }))
})

const widgets: IWidget<object>[] = [
  {
    _name: '容器',
    _view: 'container',
    style: {},
    schema: {
      props: [
        { type: 'input', label: '名称', key: 'title', rules: { required: true, message: '名称' } },
      ],
      style: [
        { type: 'number', label: '高度', key: 'height' },
      ],
    },
  },
  {
    _name: '菜单',
    _view: 'menuItem',
    style: {},
    meta: {
      draggable: false,
    },
    schema: {
      props: [
        { type: 'input', label: '名称', key: 'title' },
      ],
      style: [
        { type: 'number', label: '高度', key: 'height' },
      ],
    },
  },
]

function handleValid() {
  editorRef.value?.valid()
}
function handleSet() {
  editorRef.value?.setData([{
    _uuid: 1,
    _view: 'container',
    title: 'manual',
  }])
}
function handleGet() {
  const res = editorRef.value?.getData()
  console.log(res)
}
</script>
