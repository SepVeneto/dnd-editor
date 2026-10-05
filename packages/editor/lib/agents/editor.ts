import { Agent, registerAgent } from '@agent/sdk'

/**
 * 编辑器 Agent：负责编辑编辑器本身（对页面组件做增删改）。
 *
 * 这里只是占位实现，用来验证 flow agent 能否把注册进来的子 agent 当工具调用，
 * 暂不真正修改编辑器。
 */
export const editorAgent = new Agent({
  name: 'edit editor',
  handoffDescription: '编辑编辑器：对页面组件执行增删改等操作。',
  instructions: `
你是编辑器操作 Agent。

你负责对编辑器本身做操作，例如新增 / 修改 / 删除页面组件。

当前是占位实现：被调用时只需要说明「编辑器 Agent 已被调用」，
不要真的去修改编辑器。
  `,
})

registerAgent(editorAgent, {
  toolName: 'edit_editor',
  toolDescription: '编辑编辑器：对页面组件执行增删改等操作。',
})
