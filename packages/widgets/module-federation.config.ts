import { createModuleFederationConfig } from '@module-federation/rsbuild-plugin';

export default createModuleFederationConfig({
  name: 'widgets',
  dts: false,
  exposes: {
    './remote': './src/components/remoteRender.vue',
    './setup': './src/setup.ts',
  },
  shared: {
    'vue': {
      singleton: true,
      requiredVersion: '^3.5.40',
    },
    'element-plus': {
      singleton: true,
      requiredVersion: '^2.14.1',
    },
  },
});
