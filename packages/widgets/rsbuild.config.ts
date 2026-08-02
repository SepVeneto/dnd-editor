import path from 'node:path'
import { defineConfig, RsbuildPlugin } from '@rsbuild/core'
import { pluginSass } from '@rsbuild/plugin-sass'
import { pluginVue } from '@rsbuild/plugin-vue'
import { pluginEditor } from '@sepveneto/dnd-plugins'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import moduleFederationConfig from './module-federation.config'

const patchRemoteRuntime = {
  name: 'patch-remote-runtime',

  setup(api) {
    api.onAfterCreateCompiler(({ compiler }) => {

    });
  },
};

export default defineConfig({
  resolve: {
    extensions: ['.vue', '.jsx', '.js', '.json', '.ts', '.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8090,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  plugins: [
    pluginEditor(),
    pluginSass(),
    pluginVue(),
    pluginModuleFederation(moduleFederationConfig),
    {
      name: 'debug-lazy-proxy',

      setup(api) {
        api.onAfterCreateCompiler(({ compiler }) => {
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
                  const name = 'static/js/widgets.js'
                  const source = assets[name].source()

                  const patched = source.replace('__webpack_require__.c = __webpack_module_cache__;', `
__webpack_require__.c = __webpack_module_cache__;


globalThis.disposeModules = function () {
const ids = __webpack_require__.m.__lazy_modules__
const keys = Object.keys(__webpack_require__.c)
for (const id of ids) {
console.log('remove', id)
keys.filter(key => key.startsWith(id)).forEach(key => {
console.log('remove', key)
  delete __webpack_require__.c[key];
})
}
};
`)

                  if (patched !== source) {
                    compilation.updateAsset(
                      name,
                      new RawSource(patched)
                    );
                  }
                }
              );
            }
          );

          compiler.hooks.compilation.tap(
            'debug-lazy-proxy',
            compilation => {
              compilation.hooks.processAssets.tap(
                {
                  name: 'debug-lazy-proxy',
                  stage: 1000,
                },
                assets => {
                  for (const name of Object.keys(assets)) {
                    if (
                      name.includes(
                        'lazy-compilation-proxy'
                      )
                    ) {

                      const source = assets[name].source()

                      console.log(name)
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
                  }
                }
              );
            })
        })
      }
    },
    patchRemoteRuntime,
  ],
  // tools: {
  //   rspack: {
  //     plugins: [
  //       {
  //                 apply(compiler) {
  //           compiler.hooks.thisCompilation.tap(
  //             'debug-mf-assets',
  //             compilation => {
  //               compilation.hooks.processAssets.tap(
  //                 {
  //                   name: 'debug-mf-assets',
  //                   stage:
  //                     compiler.webpack.Compilation
  //                       .PROCESS_ASSETS_STAGE_SUMMARIZE,
  //                 },
  //                 assets => {
  //                     console.log(assets['static/js/widgets.js'].source().includes('__webpack_require__.c'))
  //                 }
  //               );
  //             }
  //           );
  //         },
  //       }
  //     ]
  //   }
  // }
})

