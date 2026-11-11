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
    :widgets="widgets"
    agent
    :agent-api="agentApi"
    :agent-sub-agents="agentSubAgents"
    :extra="{ obj: 'test' }"
    @change="onUpdate"
  />
  <pre>config: {{ config }}</pre>
</template>

<script setup lang="ts">
import type {
  AgentHostApi,
  AgentSubAgent,
} from '@sepveneto/dnde-agent'
import type { IWidget } from '@sepveneto/dnde-core'
import type { EditorInstance } from '@/main'
import {
  Agent,
  createEditorDslTools,
  tool,
} from '@sepveneto/dnde-agent'
import { schema, widget } from '@sepveneto/dnde-core/helper'
// import { register } from '../dist/editor.js'
import { onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { register } from '@/main'

/**
 * 业务侧（playground）：
 * 宿主提供编辑器 API、业务工具和可选的业务子 Agent；主 Agent Runtime 由 <dnd-agent> 提供。
 */

/** 查询指定场景的业务数据，供编辑流程补全组件内容。 */
const queryScenario = tool({
  name: 'query_scenario',
  description: '查询指定场景的业务数据，用于编辑时补全组件内容。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    required: ['name'],
    additionalProperties: false,
  },
  strict: false,
  async execute(input) {
    const { name } = input as { name: string }
    const res = await fetch('http://localhost:4000/v1/business/scenes')
    const resJson = await res.json()
    return resJson.data.find((each: any) => each.name === name) ?? null
  },
})

/** 查询场景是否已经开通（只读）。 */
const checkScenario = tool({
  name: 'check_scenario',
  description: '查询业务系统中指定场景的开通状态，只查询不修改。',
  parameters: {
    type: 'object',
    properties: {
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
          additionalProperties: false,
        },
      },
    },
    required: ['scenarios'],
    additionalProperties: false,
  },
  strict: false,
  async execute(input) {
    const { scenarios } = input as { scenarios: Array<{ name: string }> }
    const res = await fetch('http://localhost:4000/v1/business/scenes')
    const resJson = await res.json()
    return scenarios.map((item) => {
      const target = resJson.data.find((each: any) => each.name === item.name)
      if (!target)
        throw new Error(`cannot find scene ${item.name}`)
      return { id: target.id, name: target.name, enabled: !!target.status }
    })
  },
})

/** 开通场景（写操作，需要人工确认）。 */
const enableScenario = tool({
  name: 'enable_scenario',
  description: '开通业务系统中指定的场景。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
    },
    required: ['id', 'name'],
    additionalProperties: false,
  },
  strict: false,
  async execute(input) {
    const { id, name } = input as { id: number, name: string }
    // eslint-disable-next-line no-alert
    if (!window.confirm(`场景「${name}」未开通，是否需要开通？`))
      return { rejected: true }

    const res = await fetch('http://localhost:4000/v1/business/scene', { method: 'post' })
    const resJson = await res.json()
    if (resJson.code !== 0)
      throw new Error(resJson.message ?? `场景 ${name} 开通失败`)
    return { id, name, enabled: true }
  },
})

const agentTools = [
  queryScenario,
  checkScenario,
  enableScenario,
]

const refEditor = useTemplateRef<EditorInstance>('editorRef')
const agentEditorTools = createEditorDslTools({
  editor: {
    getCurrentEditor: () => ({
      page: refEditor.value?.getData(),
      revision: refEditor.value?.getRevision(),
    }),
    getWidgets: () => refEditor.value?.getCapabilities(),
    validateDsl: (dsl, context) => refEditor.value?.validateDsl(dsl, context) ?? {
      ok: false,
      issues: [{
        code: 'editor_unavailable',
        path: '',
        message: '编辑器尚未就绪',
      }],
    },
    applyDsl: (dsl, context) => refEditor.value?.applyDsl(dsl, context),
    undo: revision => refEditor.value?.undo(revision),
  },
})

const pageAgent = new Agent({
  name: 'Page Agent',
  handoffDescription: '处理页面编辑、布局和业务数据查询请求。',
  model: 'qwen3.6-plus',
  instructions: [
    '先读取当前编辑器与组件能力目录，再规划修改。',
    '所有页面修改都通过 apply_editor_dsl 提交完整、版本化的 DSL。',
    '业务数据只能来自宿主业务工具；完成后直接结束并返回处理结果。',
  ].join('\n'),
  tools: [
    ...agentEditorTools,
    ...agentTools,
  ],
})

const agentSubAgents: AgentSubAgent[] = [pageAgent]

const agentApi: AgentHostApi = {
  model: {
    baseURL: 'http://localhost:4000/v1',
    model: 'qwen3.6-plus',
    apiMode: 'responses' as const,
  },
}

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

// 元素在 import 时就注册好了：不需要等 register() 完成，也不需要 v-if 去卡渲染时机
register({
  // ?remote= 用来连到临时起的生产者（默认 8090 可能已被别的进程占用）
  remoteUrl: new URLSearchParams(location.search).get('remote') || 'http://localhost:8090',
  // 业务侧显式注入 agent 的加载方式；不注入也不影响编辑器本身使用
  agent: () => import('@sepveneto/dnde-agent/element'),
})

onMounted(() => {
  // 编辑器可能还没挂载完，这里调用的扩展注册会先排队，挂载后自动补上
  refEditor.value?.register(ctx => ({
    // helper: 节点的操作菜单
    // widget: 组件菜单
    init() {
      // addPanel 给根节点配置区增加一个标签；
      // 固定组件的点击只用于定位到该配置标签，不会进入独立的组件编辑态
      ctx.plugins.config.addPanel(
        widget.create({
          name: '浮窗',
          type: 'dialog',
          defaultData: { isShow: 0 },
          defaultStyle: {
            position: 'absolute',
            width: 48,
            height: 48,
            bottom: 20,
            right: 20,
          },
          // 组件自身的内容配置项，选中组件后于「属性」中编辑
          attributes: [
            schema.switch({ label: '显示', key: 'isShow', attrs: { activeValue: 1, inactiveValue: 0 } }),
            schema.number({ label: '浮窗层级', key: 'zIndex' }),
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
        }),
      )
      ctx.plugins.config.addPanel(
        widget.create({
          name: '弹窗1',
          type: 'dialog1',
          defaultData: { isShow: 0 },
          defaultStyle: {
            position: 'absolute',
            width: 120,
            height: 40,
            bottom: 80,
            right: 20,
          },
          attributes: [
            schema.switch({ label: '显示', key: 'isShow', attrs: { activeValue: 1, inactiveValue: 0 } }),
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
        }),
      )
      // 纯配置标签：不关联组件，只是给根节点补充一组配置项
      ctx.plugins.config.addPanel(widget.create({
        name: '页面设置',
        type: 'pageSettings',
        attributes: [
          schema.switch({ label: '允许分享', key: 'shareable' }),
        ],
      }))
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
const baseWidgets: IWidget[] = [
  widget.root({
    name: '活动设置',
    attributes: [
      schema.topbar({
        label: '顶部导航栏',
        key: 'topbar',
        options: [{ label: '显示', value: 1 }, { label: '隐藏', value: 0 }],
      }),
      schema.custom({
        type: 'element',
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
      schema.styleNumber({
        label: '1',
        key: 'width',
      }),
    ],
  }),
  widget.columnContainer({
    icon: 'column',
    defaultStyle: { width: 375, height: 100 },
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
    config: { draggable: false, fixed: 'header' },
    defaultStyle: { width: 375, height: 44 },
  }),
  widget.create({
    name: '底部',
    type: 'footer',
    config: { draggable: false, fixed: 'footer' },
    defaultStyle: { width: 375, height: 44 },
  }),
]
const serviceWidgets: IWidget[] = [
  widget.create({
    name: '回到顶部',
    type: 'top',
    defaultStyle: {
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 100,
      height: 100,
    },
  }),
  widget.create({
    name: '菜单',
    type: 'menuItem',
    defaultData: {
      isShow: 1,
    },
    defaultStyle: { width: 375, height: 300 },
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
  widget.create({
    name: '金刚区',
    type: 'jgq',
    defaultData: {
      isShow: 1,
    },
    defaultStyle: {
      width: 375,
      height: 200,
    },
    attributes: [
      schema.input({
        label: '标题',
        key: 'title',
      }),
    ],
    agent: {
      layout: {
        description: '紧凑规则网格。适合大量同类元素，需要提高信息密度、方便用户快速浏览的场景。多个元素可以同时放入一个组件中。不适合少量元素的突出展示。',
        direction: 'row',
        density: 'high',
        priority: 'large',
      },
      // 组件创建完成后，业务侧决定数据怎么写入组件
      update: (node, item) => {
        node.data.list = item.items
      },
    },
  }),
  widget.create({
    name: '图片组件',
    type: 'picture',
    defaultData: {
      isShow: 1,
    },
    agent: {
      layout: {
        description: '较大的独立展示区域。固定占一整行，单行排列。适合少量元素，需要突出单个元素的场景。推荐一个元素使用一个组件，使每个元素获得较大的展示面积。',
        direction: 'row',
        density: 'low',
        priority: 'large',
      },
      // 组件创建完成后，业务侧决定数据怎么写入组件
      update: (node, item) => {
        console.log('update', node, item)
        node.data.list = item.items
      },
    },
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
