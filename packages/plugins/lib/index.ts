import type { RsbuildPlugin } from '@rsbuild/core'
import { ShadowDomRuntimeCss } from './ShadowDomRuntimeCss'
import { Compiler } from '@rspack/core';

const exposeDispose = `
__webpack_require__.c = __webpack_module_cache__;


globalThis.__disposeModules = function () {
  const ids = __webpack_require__.m.__lazy_modules__
  if (!ids) return
  const keys = Object.keys(__webpack_require__.c)
  for (const id of ids) {
    keys.filter(key => key.startsWith(id)).forEach(key => {
      delete __webpack_require__.c[key];
    })
  }
};
`

export const pluginEditor: (options?: { name?: string }) => RsbuildPlugin = (options) => ({
  name: 'pluginShadowDomRuntimeCss',
  setup(api) {
    api.modifyRspackConfig((config) => {
      config.plugins.push(new ShadowDomRuntimeCss())
    })
    api.onAfterCreateCompiler((_options) => {
      const compiler = _options.compiler as Compiler;
      const { RawSource } = compiler.webpack.sources;

      compiler.hooks.thisCompilation.tap(
        'patch-remote-runtime',
        compilation => {
          compilation.hooks.processAssets.tap(
            {
              name: 'patch-remote-runtime',
              stage:
                compiler.webpack.Compilation
                  .PROCESS_ASSETS_STAGE_OPTIMIZE,
            },
            assets => {
              const remoteEntry = options?.name || 'remoteEntry'

              for (const name of Object.keys(assets)) {
                if (
                  name.includes(
                    'lazy-compilation-proxy'
                  )
                ) {

                  const source = assets[name].source() as string

                  const patched = source.replace(
                    /module\.exports = __webpack_require__\.e\((.*?)\)\.then\(__webpack_require__\.bind\(__webpack_require__, (.*?)\)\);/,
                    (match, chunkId, moduleId) => {
                      // ./src/widgets/menuItem.view.vue!lazy-compilation-proxy
                          return `
__webpack_require__.m.__lazy_modules__ ??= new Set();
__webpack_require__.m.__lazy_modules__.add('${moduleId.replaceAll('"', '')}');

module.exports = __webpack_require__.e(${chunkId})
  .then(__webpack_require__.bind(__webpack_require__, ${moduleId}));
`;
                    }
                  );

                  if (patched !== source) {
                    compilation.updateAsset(
                      name,
                      new RawSource(patched)
                    );
                  }
                }

                if (name.includes(`js/${remoteEntry}`)) {
                  const source = assets[name].source() as string

                  const patched = source.replace('__webpack_require__.c = __webpack_module_cache__;', exposeDispose)

                  if (patched !== source) {
                    compilation.updateAsset(
                      name,
                      new RawSource(patched)
                    );
                  }
                }
              }
            }
          );
        }
      );
    })
  },
})
