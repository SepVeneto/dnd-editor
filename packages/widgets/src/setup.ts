import ElementPlus from 'element-plus'
import BcComp from '@sepveneto/basic-comp'
import bcStyle from '@sepveneto/basic-comp/css?inline'

// 编辑器创建应用时会依次 app.use(plugin, options)
export const use = [{ plugin: ElementPlus, options: {} }, { plugin: BcComp, options: {} }]

// 生产者自己的样式：会被注入到编辑器的 shadow root 中；
// 编辑器还会把同一份样式投放到宿主页面的 document.head，
// 兜住 createDialog / ElSelect 下拉等 teleport 到 body、拿不到 shadow DOM 样式的弹层。
// element-plus 的主题（含 teleport 到 document.body 的弹层）由编辑器统一注入，
// 不需要也不应该在这里再放一份 element-plus 的 CSS —— 那是另一套 el- 前缀，
// 与编辑器的 mpd 命名空间对不上，只会白白增大 shadow root 的样式体积。
export const styles: string[] = [bcStyle]
