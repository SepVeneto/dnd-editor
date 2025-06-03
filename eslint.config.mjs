// eslint.config.mjs
import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'vue/block-order': ['warn', { order: ['template', 'script', 'style'] }],
    'vue/max-attributes-per-line': ['warn', {
      singleline: { max: 1 },
      multiline: { max: 1 },
    }],
  },
})
