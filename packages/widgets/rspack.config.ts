import path from 'node:path'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'
import { pluginSass } from '@rsbuild/plugin-sass'
import { pluginVue } from '@rsbuild/plugin-vue'
import { pluginEditor } from '@sepveneto/dnd-plugins'

export default defineConfig({
  mode: 'development',
  html: {
    template: 'index.html',
  },
  source: {
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: true,
    },
    entry: {
      index: path.resolve(__dirname, './src/main.ts'),
    },
  },
  resolve: {
    extensions: ['.vue', '.jsx', '.js', '.json', '.ts', '.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  dev: {
    hmr: false,
  },
  server: {
    // server: 'https',
    compress: true,
    port: 8090,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  output: {
    target: 'web',
    // assetPrefix: 'auto',
  },
  plugins: [
    pluginEditor(),
    pluginSass(),
    pluginVue(),
    pluginModuleFederation({
      dts: false,
      name: 'widgets',
      filename: 'remoteEntry.js',
      library: {
        type: 'umd',
        name: 'widgets',
      },
      exposes: {
        './viewRender': './src/components/viewRender.vue',
        './configRender': './src/components/configRender.vue',
        './remote': './src/components/remoteRender.vue',
      },
      shared: ['vue', 'vue-router', 'element-plus'],
    }),
  ],
})
