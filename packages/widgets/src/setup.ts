import ElementPlus from 'element-plus'

// 编辑器创建应用时会依次 app.use(plugin, options)
export const use = [{ plugin: ElementPlus, options: {} }]

// 生产者自己的样式：会被注入到编辑器的 shadow root 中。
// element-plus 的主题（含 teleport 到 document.body 的弹层）由编辑器统一注入，
// 不需要也不应该在这里再放一份 element-plus 的 CSS —— 那是另一套 el- 前缀，
// 与编辑器的 mpd 命名空间对不上，只会白白增大 shadow root 的样式体积。
export const styles: string[] = []
