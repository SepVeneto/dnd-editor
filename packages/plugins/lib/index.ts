import type { RsbuildPlugin } from '@rsbuild/core'
import { ShadowDomRuntimeCss } from './ShadowDomRuntimeCss'

export const pluginEditor: () => RsbuildPlugin = () => ({
  name: 'pluginShadowDomRuntimeCss',
  setup(api) {
    api.modifyRspackConfig((config) => {
      config.plugins.push(new ShadowDomRuntimeCss())
    })
  },
})
