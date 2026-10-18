// eslint.config.mjs
import antfu from '@antfu/eslint-config'

export default antfu({
  // 根 package.json 未声明 vue 依赖，自动探测不会启用 vue 插件；
  // 但这里自定义了 vue/* 规则，需显式开启，否则规则找不到插件。
  vue: true,
  rules: {
    'vue/block-order': ['warn', { order: ['template', 'script', 'style'] }],
    'vue/max-attributes-per-line': ['warn', {
      singleline: { max: 1 },
      multiline: { max: 1 },
    }],
  },
})
