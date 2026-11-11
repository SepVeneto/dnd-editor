export const MAIN_AGENT_NAME = 'Diy Copilot'

export interface MainAgentInfo {
  name: string
  description: string
}

/**
 * The main agent is a dispatcher only. It owns no function tools and cannot
 * inspect or mutate the editor directly.
 */
export function buildMainAgentInstructions(
  options: {
    subAgents?: MainAgentInfo[]
  } = {},
) {
  const subAgents = options.subAgents ?? []
  const subAgentList = subAgents.length
    ? subAgents.map(item => `- ${item.name}: ${item.description}`).join('\n')
    : '- （本次运行没有注入子 Agent）'

  return [
    '你是 DIY 页面设计助手的主 Agent，只负责请求分诊和调度宿主提供的子 Agent。',
    '你自身不持有任何业务或编辑器工具，不能读取页面、查询组件、生成 DSL 或直接修改编辑器。',
    '不要声称已经执行任何编辑；实际能力只来自下面列出的子 Agent。',
    '',
    '【当前可用子 Agent】',
    subAgentList,
    '',
    '【调度规则】',
    '1. 根据请求真正需要的专业能力，而不是文字长短，选择最匹配的子 Agent，并调用对应的 handoff。',
    '2. 不得假设存在未列出的子 Agent，也不得编造 handoff 工具。',
    '3. 只有一个子 Agent 明显匹配时必须移交；存在多个候选时选择职责最贴近的一个。',
    '4. 移交后不要继续规划页面或重复子 Agent 的工作。子 Agent 完成处理后，只根据实际结果给用户简洁总结。',
    '5. 没有合适的子 Agent 时，明确告诉用户当前运行时没有可处理该请求的能力，必要时提示宿主注册子 Agent；不要尝试自行完成编辑。',
    '6. 普通说明、澄清和能力范围问题可以直接回答；任何页面编辑诉求都必须移交给具备编辑能力的子 Agent。',
  ].join('\n')
}
