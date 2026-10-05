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
    @change="onUpdate"
  />
  <pre>config: {{ config }}</pre>
</template>

<script setup lang="ts">
import type { IWidget } from '@sepveneto/dnde-core'
import type { EditorInstance } from '@/main'
import { schema, widget } from '@sepveneto/dnde-core/helper'
// import { register } from '../dist/editor.js'
import { onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { register } from '@/main'
import { Agent, registerAgent, tool, z } from '@agent/sdk'

/**
 * 业务侧（playground）：
 * docsAgent / verifyAgent 与审批实现都属于业务，注册后由 @agent/sdk 的流程 Agent 当工具调用。
 */

const businessConfigSchema = z.object({
  scenes: z.array(
    z.object({
      name: z.string(),
      fee: z.string(),
    })
  ),
  brand: z.array(
    z.object({
      name: z.string(),
      coupon: z.string(),
      faceValue: z.number().nullable(),
      fee: z.string(),
    })
  ),
  shopPickup: z.array(
    z.object({
      name: z.string(),
      scope: z.array(z.string()),
    })
  ),
})

const docsAgent = new Agent({
  name: 'parse desc',
  instructions: `
你是一个业务配置文档解析器。

你的任务是将用户提供的自然语言、表格、Word 文档文本或混合格式内容，
解析成结构化业务配置。

规则：

1. 只解析用户提供的信息。
2. 不调用任何工具。
3. 不补充用户没有提供的信息。
4. 不删除重复记录。
5. 不合并重复行。
6. 用户没有提供的字段使用 null。
7. 保留用户输入中的原始名称、数值和描述。
8. 表格每一行都必须独立解析。
9. 手续费保持原始百分比形式，例如 "2%"。
10. 面值是数字时输出 number。
11. 不进行业务查询。
12. 不判断配置是否正确。
13. 不进行名称匹配。

需要解析三类配置：

H5外接场景：
- name
- fee

品牌商户：
- name
- coupon
- faceValue
- fee

扫码提货：
- name
- scope

最终只输出结构化数据。
  `,
  outputType: businessConfigSchema,
})

/** 校验过程中拿到的业务数据 */
const businessData = ref<any>({})

const checkScenesTool = tool({
  name: 'check_scenes_enabled',
  description: `
查询业务系统中指定场景的开通状态。

输入场景名称列表，调用业务接口查询这些场景是否已经开通。
只负责查询，不修改配置，不进行业务判断。
返回每个场景对应的开通状态以及业务系统返回的信息。
  `,
  parameters: z.object({
    scenes: z.array(z.object({ name: z.string() })),
  }),
  // mock 查询接口：只负责返回各场景的开通状态
  invoke: async (input: { scenes: Array<{ name: string }> }) => {
    const res = await fetch('http://localhost:4000/v1/business/scenes')
    const resJson = await res.json()
    const scenes: any[] = input.scenes.map((item) => {
      const target = resJson.data.find((each: any) => each.name === item.name)
      if (!target) {
        throw new Error('cannot find scene ' + item.name)
      }
      return {
        id: target.id,
        name: target.name,
        enabled: !!target.status,
        message: target.status
          ? '业务系统返回：场景已开通'
          : '业务系统返回：场景未开通',
      }
    })

    businessData.value['scenes'] = scenes

    const disabled = scenes.filter(scene => !scene.enabled).map(scene => scene.name)
    return {
      scenes,
      message: disabled.length
        ? `以下场景未开通：${disabled.join('、')}。需要自行开通。`
        : '所有场景均已开通。',
    }
  },
})

// 开通属于写操作：调用本工具后运行时会自动暂停并请用户确认，
// 所以模型应当直接调用，而不是在文本里询问用户。
const enableSceneTool = tool({
  name: 'enable_scene',
  description: `
开通业务系统中指定的场景。
  `,
  parameters: z.object({
    id: z.number(),
    name: z.string(),
  }),
  needsApproval: true,
  // 审批文案与同意 / 拒绝回调，和 needsApproval 一样写在 tool 上
  approval: {
    message: (input: { id: number, name: string }) => `场景「${input.name}」未开通，是否需要开通？`,
    onApprove: (input: { id: number, name: string }) => {
      console.log('[business] 同意开通', input)
    },
    onReject: (input: { id: number, name: string }) => {
      console.log('[business] 拒绝开通', input)
    },
  },
  // mock 开通逻辑
  invoke: async (input: { id: number, name: string }) => {
    const res = await fetch('http://localhost:4000/v1/business/scene', { method: 'post' })
    const resJson = await res.json()
    if (resJson.code !== 0) {
      throw new Error(resJson.message ?? `场景 ${input.name} 开通失败`)
    }
    return {
      id: input.id,
      name: input.name,
      enabled: true,
      message: `业务系统返回：场景 ${input.name} 已开通`,
    }
  },
})

const verifyAgent = new Agent({
  name: 'verify configuration',
  instructions: `
你是业务配置校验器。

你的输入是 Parser Agent 解析得到的结构化业务配置。

你的任务是：

1. 根据输入中的场景信息，调用 check_scenes_enabled 工具。
2. 将用户提供的场景名称传给工具。
3. 根据工具返回的真实业务数据判断每个场景是否已开通。
4. 不修改用户提供的原始配置。
5. 不自行假设业务系统中不存在的数据。
6. 如果工具返回的信息不足以判断，则明确说明无法判断。
7. 对每个「未开通」的场景，直接调用 enable_scene 发起开通，一次可以请求多个。
   用户确认由工具自动触发，禁止在回复文本里询问「是否要开通」，直接调用工具即可。
8. 如果某个场景用户不同意开通，不要重试，继续处理下一个未开通的场景。
9. 最终汇总所有场景的检查结果。

必须调用 check_scenes_enabled 工具获取真实业务数据，
不能仅根据用户输入直接判断场景是否开通。
  `,
  tools: [checkScenesTool, enableSceneTool],
})

registerAgent(verifyAgent, {
  toolName: 'verify_agent',
  toolDescription: '校验业务配置，检查并开通未开通的场景。',
})
registerAgent(docsAgent, {
  toolName: 'docs_agent',
  toolDescription: '把用户提供的自然语言 / 表格 / 文档文本解析成结构化业务配置。',
})

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
register({ remoteUrl: "http://localhost:8090" }).then(() => {
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
