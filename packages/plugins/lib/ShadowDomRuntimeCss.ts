import type { Compiler, RspackPluginInstance } from '@rspack/core'

export class ShadowDomRuntimeCss implements RspackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('ShadowDomRunTimeCss', (compilation) => {
      compilation.hooks.runtimeModule.tap('ShadowDomRunTimeCss', (module) => {
        if (module.name !== 'css loading')
          return

        const generate = module.generate.bind(module)

        module.generate = () => {
          const source = generate()

          return source.replace('document.head.appendChild(linkTag)', 'window.__shadowdom_css_runtime__(linkTag); ')
        }
      })
    })
  }
}
