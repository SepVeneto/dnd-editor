// eslint.config.mjs
import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'vue/block-order': ['warn', { order: ['template', 'script', 'style'] }],
  },
})
