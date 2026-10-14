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

/**
 * 库内联的运行时（`vue` / `zod` / `openai` / `@openai/agents`）统一按生产模式编译。
 *
 * 库模式下 vite 不会替换 `process.env.NODE_ENV`（留给宿主替换），这份内联 `vue` 于是会跟着
 * 宿主的构建模式漂移：
 * - 宿主 dev 构建把它切成 dev 版，它在模块初始化时执行
 *   `getGlobalThis().__VUE_HMR_RUNTIME__ = { createRecord, rerender, reload }`，用自己那份
 *   HMR 运行时（record / instance 都存在它模块私有的 Map 里）覆盖宿主的全局运行时。宿主 `.vue`
 *   热更新随后拿到的是这份空表，`rerender` / `reload` 找不到已挂载实例，页面不报错、改动也不再
 *   生效——宿主 HMR 静默失效；
 * - 产物被浏览器当 ESM 直接加载（不经宿主的 define）时，还会因 `process` 未定义而崩。
 *
 * 构建期固化 `NODE_ENV=production`：内联 vue 只保留生产分支、不写任何宿主全局，行为也不再随
 * 宿主构建模式漂移（库自己的 UI 调试走 playground，那边是直接从源码起的 dev 版 vue）。
 */
export const agentDefine: Record<string, string> = {
  'process.env.NODE_ENV': JSON.stringify('production'),
}
