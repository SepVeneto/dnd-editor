import { type Compiler, type RspackPluginInstance } from '@rspack/core'

/**
 * rspack 运行时的 css chunk 加载：
 *  - 把 `<link>` 从 `document.head` 改挂到编辑器的 shadow root（由编辑器提供的
 *    `window.__shadowdom_css_runtime__` 接管）；
 *  - 热更新时 rspack 要先找到「旧的样式表」再插入新的 `<link>`。它默认只在 document 里找，
 *    而样式在 shadow root 中 —— 找不到就整段放弃，表现为改了生产者的样式不生效。
 *    因此把查找扩展到 shadow root：编辑器暴露 `window.__dnde_find_shadow_css__(href, fullhref)`。
 */
const APPEND_ANCHOR = 'document.head.appendChild(linkTag)'
/** 老版运行时用它标记「chunk 已装好」；改成 null 可让样式在 shadow root 重建后重新投放 */
const INSTALLED_ANCHOR = 'installedCssChunks[chunkId] = 0'

/** 新版（rspack 2.x）运行时把查找抽成了 extractCssFindStylesheet，扫描 <link> 与 <style data-href> */
const FIND_STYLE_ANCHOR = 'var existingStyleTags = document.getElementsByTagName("style");'
const FIND_STYLE_PATCH = `var shadowStylesheet = typeof window.__dnde_find_shadow_css__ === "function" && window.__dnde_find_shadow_css__(href, fullhref);
	if (shadowStylesheet) return shadowStylesheet;
	${FIND_STYLE_ANCHOR}`

export class ShadowDomRuntimeCss implements RspackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap('ShadowDomRunTimeCss', (compilation) => {

      compilation.hooks.processAssets.tap(
        {
          name: 'ShadowDomCss',
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE
        },
        assets => {
          for (const filename of Object.keys(assets)) {
            if (!filename.endsWith('.js')) continue

            const source = assets[filename].source().toString()
            let patched = source

            // 挂载点重定向：样式只进 shadow root，不污染宿主页面。
            // 两个锚点在运行时的不同版本里未必同时出现，各自独立替换，否则重定向可能整个失效
            // （样式会被挂到 document.head，shadow root 里就「丢样式」了）。
            if (patched.includes(APPEND_ANCHOR)) {
              patched = patched.replace(APPEND_ANCHOR, 'window.__shadowdom_css_runtime__(linkTag)')
            }
            if (patched.includes(INSTALLED_ANCHOR)) {
              patched = patched.replace(INSTALLED_ANCHOR, 'installedCssChunks[chunkId] = null')
            }

            // 热更新的样式查找：让 shadow root 里的样式表也能被找到，改样式才会生效。
            if (patched.includes(FIND_STYLE_ANCHOR)) {
              patched = patched.replace(FIND_STYLE_ANCHOR, FIND_STYLE_PATCH)
            }

            if (patched !== source) {
              compilation.updateAsset(
                filename,
                new compiler.rspack.sources.RawSource(patched)
              )
            }
          }
        }
      )
    })
  }
}
