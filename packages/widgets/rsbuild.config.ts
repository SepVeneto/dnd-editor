import path from 'node:path'
import { defineConfig, RsbuildPlugin } from '@rsbuild/core'
import { pluginSass } from '@rsbuild/plugin-sass'
import { pluginVue } from '@rsbuild/plugin-vue'
import { pluginEditor } from '@sepveneto/dnd-plugins'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import moduleFederationConfig from './module-federation.config'

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
    pluginEditor(moduleFederationConfig),
    pluginSass(),
    pluginVue(),
    pluginModuleFederation(moduleFederationConfig),
  ],
})

