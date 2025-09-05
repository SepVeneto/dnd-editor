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
import { schema, widget } from '@sepveneto/dnde-core/helper'
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
    // helper: 节点的操作菜单
    // widget: 组件菜单
    init() {
      // const copy = createCopy(ctx)
      // const del = createDelete(ctx)
      ctx.plugins.helper.addBuiltin({
        name: 'export',
        title: '导出组件配置',
        action: (node) => {
          console.log('export', node)
        },
        condition: (node) => {
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
    schema.input({
      label: '标题',
      key: 'title',
      required: true,
    }),
    schema.number({
      label: '数字',
      key: 'num',
    }),
    schema.select({
      label: '选择器',
      key: 'opts',
      options: [{ label: '选项1', value: 'option1' }, { label: '选项2', value: 'option2' }],
    }),
  ],
  style: [
    schema.input({
      label: '标题',
      key: 'title',
      required: true,
    }),
  ],
}
const baseWidgets: IWidget<object>[] = [
  widget.columnContainer({
    icon: 'column',
    attributes: [
      schema.input({
        label: '标题',
        key: 'title',
        required: true,
      }),
    ],
    stylesheet: [
      schema.number({
        label: '高度',
        key: 'height',
      }),
    ],
  }),
]
const serviceWidgets: IWidget<object>[] = [
  widget.create({
    name: '菜单',
    type: 'menuItem',
    config: { draggable: true },
    attributes: [
      schema.input({
        label: '标题',
        key: 'title',
        required: true,
      }),
    ],
    stylesheet: [
      schema.styleNumber({
        label: '高度',
        key: 'width',
        required: '1',
      }),
    ],
  }),
]
const widgets = [
  widget.group('基础组件', baseWidgets),
  widget.group('业务组件', serviceWidgets),
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
