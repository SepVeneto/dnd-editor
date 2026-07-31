import { type Compiler, type RspackPluginInstance } from '@rspack/core'

export class ShadowDomRuntimeCss implements RspackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap('ShadowDomRunTimeCss', (compilation) => {

      compilation.hooks.processAssets.tap(
        {
          name: 'ShadowDomCss',
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE
        },
        assets => {
          for (const filename of Object.keys(assets)) {
            if (!filename.endsWith('.js')) continue

            const source = assets[filename].source().toString()

            if (source.includes('document.head.appendChild(linkTag)')
              && source.includes('installedCssChunks[chunkId] = 0')
            ) {
              compilation.updateAsset(
                filename,
                new compiler.rspack.sources.RawSource(
                  source.replace(
                    'document.head.appendChild(linkTag)',
                    'window.__shadowdom_css_runtime__(linkTag)'
                  ).replace('installedCssChunks[chunkId] = 0', 'installedCssChunks[chunkId] = 1')
                )
              )
            }
          }
        }
      )
    })
  }
}
