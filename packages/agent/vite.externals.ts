/**
 * agent 包的运行时依赖。
 *
 * 为空表示 `vue` / `zod` / `openai` / `@openai/agents` 全部打进 `dist`：宿主不再需要为
 * agent 的运行时依赖买单，安装时也不会把这一大堆包写进业务侧的 lock，从而把污染降到最低。
 *
 * 依赖实例的共享由包内保证：`/element` 入口只 `import` 库入口 `index`（保持 external 的
 * 包名），组件定义与 `defineCustomElement`、`configureModel` 配置、capability 注册表都来自
 * 同一份 `index.js`，不会出现多实例状态被拆散的问题。
 */
export const agentExternals: RegExp[] = []
