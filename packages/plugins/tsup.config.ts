import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['lib/*.ts'],
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
})
