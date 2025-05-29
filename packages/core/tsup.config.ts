import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/**/*.ts', 'src/*.ts'],
  clean: true,
  dts: true,
  external: ['vue'],
  format: ['cjs', 'esm'],
})
