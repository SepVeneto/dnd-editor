/**
 * agent 包的运行时依赖。
 *
 * 这些依赖由宿主（业务侧）提供，库产物里保留为 import，避免打进 `dist` 后被重复打包、
 * 导致同一份实例状态被拆成多份（例如 `configureModel` 的配置、capability 注册表）。
 */
export const agentExternals: RegExp[] = [
  /^vue($|\/)/,
  /^zod($|\/)/,
  /^openai($|\/)/,
  /^@openai\/agents($|\/)/,
]
