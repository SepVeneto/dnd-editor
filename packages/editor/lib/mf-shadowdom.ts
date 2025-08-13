import type { FederationRuntimePlugin } from '@module-federation/enhanced/runtime'

export default function (): FederationRuntimePlugin {
  return {
    name: 'shadow-dom',
    beforeInit(args) {
      console.log('[build time inject] beforeInit: ', args)
      return args
    },
    beforeLoadShare(args) {
      console.log('[build time inject] beforeLoadShare: ', args)
      return args
    },
    init(args) {
      console.log('[build time inject] init: ', args)
      return args
    },
    beforeRequest(args) {
      console.log('[build time inject] beforeRequest: ', args)
      return args
    },
    afterResolve(args) {
      console.log('[build time inject] afterResolve: ', args)
      return args
    },
    fetch(args) {
      console.log('fetch', args)
      return args
    },
  }
}
