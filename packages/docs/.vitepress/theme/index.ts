import type { EnhanceAppContext } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import theme from 'vitepress/theme'

import './custom.scss'
import '@shikijs/vitepress-twoslash/style.css'

export default {
  extends: theme,
  enhanceApp({ app }: EnhanceAppContext) {
    // @ts-expect-error: ignore
    app.use(TwoslashFloatingVue)
  },
}
