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
    v-if="rendering"
    ref="editorRef"
    :widgets="widgets"
    agent
    :capabilities="capabilities"
    :workflows="workflows"
    :extra="{ obj: 'test' }"
    @change="onUpdate"
  />
  <pre>config: {{ config }}</pre>
</template>

<script setup lang="ts">
import type { IWidget } from '@sepveneto/dnde-core'
import type { Capability, Workflow } from '@sepveneto/dnde-agent'
import type { EditorInstance } from '@/main'
import { schema, widget } from '@sepveneto/dnde-core/helper'
// import { register } from '../dist/editor.js'
import { onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { register } from '@/main'
import { Agent, createAgent, defineCapability, defineWorkflow, invokeCapability, parseJson, runAgent, structuredExtract } from '@sepveneto/dnde-agent'
import z from 'zod'

/**
 * 业务侧（playground）：
 * 通过编辑器提供的公开原语 defineCapability / defineWorkflow 定义业务能力与流程，
 * 不需要编写 Agent、Prompt 或 Tool。
 */

const businessConfigSchema = z.object({
  scenes: z.array(z.object({ name: z.string(), fee: z.string().nullable() })),
  brand: z.array(
    z.object({
      name: z.string(),
      coupon: z.string().nullable(),
      faceValue: z.number().nullable(),
      fee: z.string().nullable(),
    }),
  ),
  shopPickup: z.array(z.object({ name: z.string(), scope: z.array(z.string()).optional() })),
})

/** 查询指定场景的业务数据，供编辑流程补全组件内容。 */
const queryScenario = defineCapability({
  name: 'query_scenario',
  description: '查询指定场景的业务数据，用于编辑时补全组件内容。',
  inputSchema: z.object({ name: z.string() }),
  async execute(input: { name: string }) {
    const res = await fetch('http://localhost:4000/v1/business/scenes')
    const resJson = await res.json()
    return resJson.data.find((each: any) => each.name === input.name) ?? null
  },
})

/** 查询场景是否已经开通（只读）。 */
const checkScenario = defineCapability({
  name: 'check_scenario',
  description: '查询业务系统中指定场景的开通状态，只查询不修改。',
  inputSchema: z.object({ scenarios: z.array(z.object({ name: z.string() })) }),
  async execute(input: { scenarios: Array<{ name: string }> }) {
    const res = await fetch('http://localhost:4000/v1/business/scenes')
    const resJson = await res.json()
    return input.scenarios.map((item) => {
      const target = resJson.data.find((each: any) => each.name === item.name)
      if (!target)
        throw new Error(`cannot find scene ${item.name}`)
      return { id: target.id, name: target.name, enabled: !!target.status }
    })
  },
})

/** 开通场景（写操作，需要人工确认）。 */
const enableScenario = defineCapability({
  name: 'enable_scenario',
  description: '开通业务系统中指定的场景。',
  inputSchema: z.object({ id: z.number(), name: z.string() }),
  needsApproval: true,
  approval: {
    message: (input: { id: number, name: string }) => `场景「${input.name}」未开通，是否需要开通？`,
  },
  async execute(input: { id: number, name: string }) {
    const res = await fetch('http://localhost:4000/v1/business/scene', { method: 'post' })
    const resJson = await res.json()
    if (resJson.code !== 0)
      throw new Error(resJson.message ?? `场景 ${input.name} 开通失败`)
    return { id: input.id, name: input.name, enabled: true }
  },
})

const initializeWorkflow = defineWorkflow({
  name: 'initialize',
  description: '根据用户输入初始化页面。',
  steps: [
    {
      name: 'parseScenario',
      async execute(context) {
        const agent = createAgent({
          name: 'structured-extract',
          instructions: `你是业务配置解析器。将用户输入解析成结构化业务配置。
需要解析三类配置：
- H5外接场景：name、fee
- 品牌商户：name、coupon、faceValue、fee
- 扫码提货：name、scope
只解析用户提供的信息，不补充、不合并、不核查，未提供的字段使用 null。`,
          outputType: businessConfigSchema,
        })

        const res = await runAgent(agent, String(context.input))
        return res.finalOutput ?? ''
      },
    },
    {
      name: 'verifyScenario',
      async execute(context) {
        const parsed = context.state.parseScenario as any
        const scenarios = (parsed?.scenes ?? []).map((item: any) => ({ name: item.name }))
        if (!scenarios.length)
          return parsed

        const result = await invokeCapability(checkScenario, { scenarios }, {
          onApproval: context.onApproval,
          signal: context.signal,
          state: context.state,
        })

        for (const scene of result as Array<{ id: number, name: string, enabled: boolean }>) {
          if (!scene.enabled) {
            try {
              await invokeCapability(enableScenario, { id: scene.id, name: scene.name }, {
                onApproval: context.onApproval,
                signal: context.signal,
                state: context.state,
              })
            }
            catch {
              // 用户不同意开通：跳过该场景，继续处理下一个
            }
          }
        }

        return parsed
      },
    },
    {
      name: 'normalizeScenario',
      async execute(context) {
        const config = (context.state.verifyScenario ?? context.state.parseScenario) as any
        return ['scenes', 'brand', 'shopPickup'].flatMap((kind) => {
          const list = config?.[kind] ?? []
          return list.length
            ? [{ kind, items: list.map((item: any, index: number) => ({ name: item.name, id: index })) }]
            : []
        })
      },
    },
  ],
})

const capabilities: Capability<any, any>[] = [queryScenario, checkScenario, enableScenario]
const workflows: Workflow[] = [initializeWorkflow]

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
const rendering = ref(false)
register({
  remoteUrl: 'http://localhost:8090',
  // 业务侧显式注入 agent 的加载方式；不注入也不影响编辑器本身使用
  agent: () => import('@sepveneto/dnde-agent/element'),
}).then(() => {
  rendering.value = true
})

onMounted(() => {
  console.log(refEditor.value)
  // refEditor.value?.register(ctx => ({
  //   // helper: 节点的操作菜单
  //   // widget: 组件菜单
  //   init() {
  //     ctx.plugins.config.addPanel({
  //       label: '弹窗',
  //       name: 'dialog',
  //       attributes: [
  //         schema.input({
  //           label: '标题',
  //           key: 'title',
  //           required: true,
  //         }),
  //         schema.time({ label: '时间', key: 'time' }),
  //         schema.number({
  //           label: '数字',
  //           key: 'num',
  //         }),
  //         schema.radioButton({ label: '单选', key: 'radio', options: [
  //           { label: '选项1', value: '1' },
  //           { label: '选项2', value: '2' },
  //         ] }),
  //       ],
  //     })
  //     ctx.plugins.config.addPanel({
  //       label: '弹窗1',
  //       name: 'dialog1',
  //       attributes: [
  //         schema.switch({
  //           label: '启用',
  //           key: 'enable',
  //         }),

  //         // schema.input({
  //         //   label: '标题',
  //         //   key: 'title',
  //         //   rules: { validator: (rule, value, cb) => {
  //         //     const data = editorRef.value!.getData()
  //         //     if (data.dialog1?.enable) {
  //         //       if (!value) {
  //         //         return cb(new Error('必填'))
  //         //       }
  //         //       else {
  //         //         cb()
  //         //       }
  //         //     }
  //         //     else {
  //         //       cb()
  //         //     }
  //         //   } },
  //         // }),
  //         // schema.select({
  //         //   label: '数字',
  //         //   key: 'num',
  //         //   options: [1, 2, 3],
  //         // }),
  //       ],
  //     })
  //     // const copy = createCopy(ctx)
  //     // const del = createDelete(ctx)
  //     ctx.plugins.helper.addBuiltin({
  //       name: 'export',
  //       title: '导出组件配置',
  //       action: (node) => {
  //         console.log('export', node)
  //       },
  //       condition: (node) => {
  //         return true
  //       },
  //     })

  //     ctx.plugins.widget.addPanel({ label: '模板', name: 'template' })
  //     // ctx.plugins.helper.addBuiltin({
  //     //   name: 'delete',
  //     //   condition: (node: any) => {
  //     //     return node.type !== 'container'
  //     //   },
  //     // })
  //   },
  // }))
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
      })
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
    }
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
    type: 'jqg',
    defaultData: {
      isShow: 1,
    },
    agent: {
      description: '紧凑规则网格。适合大量同类元素，需要提高信息密度、方便用户快速浏览的场景。多个元素可以同时放入一个组件中。不适合少量元素的突出展示。',
      layout: {
        direction: 'row',
        density: 'high',
        priority: 'large',
      },
      // 组件创建完成后，业务侧决定数据怎么写入组件
      update: (node, item) => {
        node.data.list = item.items
      },
    }
  }),
  widget.create({
    name: '图片组件',
    type: 'picture',
    defaultData: {
      isShow: 1,
    },
    agent: {
      description: '较大的独立展示区域。固定占一整行，单行排列。适合少量元素，需要突出单个元素的场景。推荐一个元素使用一个组件，使每个元素获得较大的展示面积。',
      layout: {
        direction: 'row',
        density: 'low',
        priority: 'large',
      },
      // 组件创建完成后，业务侧决定数据怎么写入组件
      update: (node, item) => {
        console.log('update', node, item)
        node.data.list = item.items
      },
    }
  })
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
