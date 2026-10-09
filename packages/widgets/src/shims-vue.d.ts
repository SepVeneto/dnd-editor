/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// `?inline` 是打包器（rsbuild/vite）的查询后缀，用于把样式作为字符串内联导入。
// TypeScript 不认识该后缀，需要显式声明，否则会报「找不到模块 .../css?inline 或其相应的类型声明」。
declare module '*?inline' {
  const content: string
  export default content
}
