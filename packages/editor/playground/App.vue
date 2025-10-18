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
  <pre>config: {{ config }}</pre>
  <mpd-editor
    ref="editorRef"
    remote-url="http://localhost:8090"
    :root="rootSchema"
    :widgets="widgets"
    @change="onUpdate"
  />
</template>

<script setup lang="ts">
import type { IWidget } from '@sepveneto/dnde-core'
import type { EditorInstance } from '@/main'
import { schema, widget } from '@sepveneto/dnde-core/helper'
// import { register } from '../dist/editor.js'
import { onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { register } from '@/main'

const config = ref({})
function onUpdate(val: CustomEvent) {
  config.value = val.detail[0]
}
function onChoose() {
  alert('choose')
}
watchEffect(() => {
  console.log(config.value)
})

const refEditor = useTemplateRef<EditorInstance>('editorRef')
register()

onMounted(() => {
  refEditor.value?.register(ctx => ({
    // helper: 节点的操作菜单
    // widget: 组件菜单
    init() {
      ctx.plugins.config.addPanel({
        label: '弹窗',
        name: 'dialog',
        attributes: [
          schema.input({
            label: '标题',
            key: 'title',
            required: true,
          }),
          schema.time({ label: '时间', key: 'time' }),
          schema.number({
            label: '数字',
            key: 'num',
          }),
          schema.radioButton({ label: '单选', key: 'radio', options: [
            { label: '选项1', value: '1' },
            { label: '选项2', value: '2' },
          ] }),
        ],
      })
      ctx.plugins.config.addPanel({
        label: '弹窗1',
        name: 'dialog1',
        attributes: [
          schema.switch({
            label: '启用',
            key: 'enable',
          }),

          // schema.input({
          //   label: '标题',
          //   key: 'title',
          //   rules: { validator: (rule, value, cb) => {
          //     const data = editorRef.value!.getData()
          //     if (data.dialog1?.enable) {
          //       if (!value) {
          //         return cb(new Error('必填'))
          //       }
          //       else {
          //         cb()
          //       }
          //     }
          //     else {
          //       cb()
          //     }
          //   } },
          // }),
          // schema.select({
          //   label: '数字',
          //   key: 'num',
          //   options: [1, 2, 3],
          // }),
        ],
      })
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
    }),
  ],
}
const baseWidgets: IWidget<object>[] = [
  widget.root({
    name: '活动设置',
    attributes: [
      schema.input({
        label: '标题',
        key: 'title',
        formItem: { labelWidth: '160px' },
        // required: true,
      }),
    ],
    stylesheet: [
      schema.color({
        label: '背景色',
        key: 'backgroundColor',
      }),
    ],
  }),
  widget.columnContainer({
    icon: 'column',
    attributes: [
      schema.input({
        label: '标题',
        key: 'title',
      }),
    ],
    stylesheet: [
      schema.number({
        label: '高度',
        key: 'height',
      }),
    ],
  }),
  widget.create({
    name: '顶部',
    type: 'header',
    config: { draggable: false, fixed: true },
    defaultStyle: { width: 375, height: 44 },
  }),
]
const serviceWidgets: IWidget<object>[] = [
  widget.create({
    name: '菜单',
    type: 'menuItem',
    defaultData: {
      isShow: 1,
    },
    attributes: [
      schema.switch({
        label: '是否显示',
        key: 'isShow',
        attrs: {
          activeValue: 1,
          inactiveValue: 0,
        },
      }),
      schema.input({
        label: '标题',
        key: 'title',
        required: true,
      }),
      schema.color({
        label: '主题',
        key: 'theme',
      }),
    ],
    stylesheet: [
      schema.styleNumber({
        label: '高度',
        key: 'width',
      }),
    ],
  }),
]
const widgets = [
  widget.group('基础组件', baseWidgets),
  widget.group('业务组件', serviceWidgets),
]

async function handleValid() {
  await refEditor.value?.validate()
  console.log('valid')
}
function handleSet() {
  refEditor.value?.setData({ _view: 'page', list: [{
    _uuid: 1,
    _view: 'menuItem',
    title: 'manual',
  }] })
}
function handleGet() {
  const res = refEditor.value?.getData()
  console.log(res)
}
</script>
