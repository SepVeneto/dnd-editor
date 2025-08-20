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
    :root="rootSchema"
    :widgets="widgets"
    @choose="onChoose"
  />
</template>

<script setup lang="ts">
import type { IWidget } from '@sepveneto/dnde-core'
import type { EditorInstance } from '@/main'
// import { register } from '../dist/editor.js'
import { onMounted, useTemplateRef } from 'vue'
import { register } from '@/main'

function onChoose() {
  alert('choose')
}

const editorRef = useTemplateRef<EditorInstance>('editorRef')
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

      ctx.plugins.widget.addPanel({ label: '模板', name: 'template' })
      // ctx.plugins.helper.addBuiltin({
      //   name: 'delete',
      //   condition: (node: any) => {
      //     return node.type !== 'container'
      //   },
      // })
    },
  }))
})

const rootSchema = {
  props: [
    { label: '标题', type: 'input', key: 'title', rules: [{ required: true, message: '请输入' }] },
    { label: '数字', type: 'number', key: 'num' },
    { label: '选择器', type: 'select', key: 'opts', options: [{ label: '选项1', value: 'option1' }, { label: '选项2', value: 'option2' }] },
  ],
  style: [
    { label: '标题', type: 'input', key: 'styles', rules: [{ required: true, message: '请输入' }] },
  ],
}
const widgets: IWidget<object>[] = [
  {
    _name: '栅格容器',
    _view: 'containerGrid',
    _icon: 'column',
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
      draggable: true,
    },
    schema: {
      props: [
        { type: 'input', label: '名称', key: 'title', rules: { required: true, message: '名称' } },
      ],
      style: [
        { type: 'number', label: '高度', key: 'height', rules: { required: true, message: '1'} },
      ],
    },
  },
]

function handleValid() {
  editorRef.value?.validate()
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
