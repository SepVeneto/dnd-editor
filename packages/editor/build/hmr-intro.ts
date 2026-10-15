/**
 * 编辑器产物最前面注入的一小段运行时代码（见 vite.config.ts 的
 * `build.rollupOptions.output.intro`）。用 `output.intro` 而不是普通模块，
 * 是因为它必须比产物里任何模块（尤其是 Vue）更早执行。
 *
 * 它解决两件事：
 *
 * 1. `process.env.NODE_ENV`：产物要保持「能被浏览器直接当 ESM 加载」（不依赖宿主的打包器，
 *    vue 等依赖都打进产物里），就直接加载时没有人替换这个表达式，读到 `process` 会直接报错，
 *    所以这里兜一个默认值。宿主若是带热更新的开发服务器，则让产物里的依赖也走开发分支 ——
 *    编辑器自带的那份 Vue 才会装上 HMR 运行时，生产者的组件视图热更新才有落点。
 *
 * 2. HMR 运行时共存：Vue 的 HMR 运行时按「实例」注册组件，并且通过全局
 *    `__VUE_HMR_RUNTIME__` 触发更新。宿主自己也可能是一个 Vue 应用（有另一份 Vue 实例），
 *    两边的运行时都不能被对方覆盖：生产者组件由编辑器这份 Vue 实例化，宿主自己的组件由宿主
 *    那份实例化。这里把全局换成一个转发器，两边的调用都转给所有运行时，各自处理自己注册过的组件。
 */
function installEditorHmrRuntime() {
  const scope: any = globalThis

  if (typeof scope.process === 'undefined' || !scope.process.env) {
    // 宿主是 Vite 开发服务器时页面里会有 dev client；其它打包器的开发服务器会自己替换
    // process.env.NODE_ENV，走不到这里
    const devServer = typeof document !== 'undefined'
      && !!document.querySelector('script[src*="/@vite/client"]')
    scope.process = { env: { NODE_ENV: devServer ? 'development' : 'production' } }
  }

  // 只有开发态才需要接管 HMR 运行时。宿主的打包器会在构建时把这里替换成 "production"
  // （那段逻辑随之被摇掉）；直接加载产物时它也只是运行时提前 return，没有全局副作用
  if (process.env.NODE_ENV === 'production')
    return

  const runtimes: any[] = scope.__DNDE_HMR_RUNTIMES__ || (scope.__DNDE_HMR_RUNTIMES__ = [])
  // 宿主那份 Vue 的运行时（早于产物加载时装上的）
  if (scope.__VUE_HMR_RUNTIME__)
    runtimes.push(scope.__VUE_HMR_RUNTIME__)

  const facade = {
    // 返回值语义与 Vue 一致：true 表示这个 id 是新注册的（调用方据此决定要不要 reload）。
    // 只有所有运行时里都已经有记录时才算「已存在」，这样才会把 reload 转发下去
    createRecord: (id: string, comp: any) => runtimes.map(runtime => runtime.createRecord(id, comp)).every(Boolean),
    rerender: (id: string, render: any) => runtimes.forEach(runtime => runtime.rerender(id, render)),
    reload: (id: string, comp: any) => runtimes.forEach(runtime => runtime.reload(id, comp)),
  }

  // 产物里那份 Vue 会在自己的初始化阶段往全局赋值，用 setter 收下来，避免互相覆盖
  Object.defineProperty(scope, '__VUE_HMR_RUNTIME__', {
    configurable: true,
    get: () => facade,
    set: (value: any) => {
      if (value && runtimes.indexOf(value) === -1)
        runtimes.push(value)
    },
  })
}

export const hmrIntro = `;(${installEditorHmrRuntime.toString()})();\n`
