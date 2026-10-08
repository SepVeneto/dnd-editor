import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  AGENT_ELEMENT_TAG,
  isAgentRegistered,
  loadAgent,
  setAgentImporter,
} from '../lib/agents/loader.ts'

/** 注入一个最小的 window.customElements，返回它的注册表便于断言。 */
function installFakeWindow(): Map<string, unknown> {
  const registry = new Map<string, unknown>()
  ;(globalThis as any).window = {
    customElements: {
      get: (tag: string) => registry.get(tag),
      define: (tag: string, ctor: unknown) => registry.set(tag, ctor),
    },
  }
  return registry
}

/** 捕获 console.error，返回收集到的调用参数，并给出还原方法。 */
function captureConsoleError() {
  const original = console.error
  const calls: unknown[][] = []
  console.error = (...args: unknown[]) => {
    calls.push(args)
  }
  return { calls, restore: () => { console.error = original } }
}

afterEach(() => {
  delete (globalThis as any).window
  setAgentImporter(undefined)
})

describe('isAgentRegistered', () => {
  it('非浏览器环境返回 false', () => {
    assert.equal(isAgentRegistered(), false)
  })

  it('元素已注册时返回 true', () => {
    const registry = installFakeWindow()
    registry.set(AGENT_ELEMENT_TAG, function Agent() {})
    assert.equal(isAgentRegistered(), true)
  })
})

describe('loadAgent', () => {
  it('非浏览器环境直接返回 false，且不触发加载', async () => {
    let imported = false
    const result = await loadAgent('test-ssr', async () => {
      imported = true
      return {}
    })
    assert.equal(result, false)
    assert.equal(imported, false)
  })

  it('元素已注册时直接返回 true，且不触发加载', async () => {
    const registry = installFakeWindow()
    registry.set('test-registered', function Agent() {})

    let imported = false
    const result = await loadAgent('test-registered', async () => {
      imported = true
      return {}
    })

    assert.equal(result, true)
    assert.equal(imported, false)
  })

  it('未注入加载器时返回 false 并提示注入方式', async () => {
    installFakeWindow()
    const { calls, restore } = captureConsoleError()
    try {
      const result = await loadAgent('test-no-importer')

      assert.equal(result, false)
      assert.equal(calls.length, 1)
      assert.match(String(calls[0]![0]), /register\(/)
      assert.match(String(calls[0]![0]), /@sepveneto\/dnde-agent/)
    }
    finally {
      restore()
    }
  })

  it('使用 setAgentImporter 注入的加载器', async () => {
    const registry = installFakeWindow()
    setAgentImporter(async () => {
      registry.set('test-injected', function Agent() {})
      return {}
    })

    const result = await loadAgent('test-injected')
    assert.equal(result, true)
  })

  it('加载成功并注册元素后返回 true', async () => {
    const registry = installFakeWindow()
    const result = await loadAgent('test-load-ok', async () => {
      registry.set('test-load-ok', function Agent() {})
      return {}
    })
    assert.equal(result, true)
  })

  it('加载成功但未注册元素时返回 false 并提示', async () => {
    installFakeWindow()
    const { calls, restore } = captureConsoleError()
    try {
      const result = await loadAgent('test-not-registered', async () => ({}))
      assert.equal(result, false)
      assert.equal(calls.length, 1)
    }
    finally {
      restore()
    }
  })

  it('包入口导出 registerAgentElement 时兜底注册', async () => {
    const registry = installFakeWindow()
    const result = await loadAgent('test-fallback', async () => ({
      registerAgentElement: (name = 'dnd-agent') => registry.set(name, function Agent() {}),
    }))
    assert.equal(result, true)
    assert.equal(registry.has('test-fallback'), true)
  })

  it('依赖缺失时在控制台提示安装并返回 false', async () => {
    installFakeWindow()
    const { calls, restore } = captureConsoleError()
    try {
      const result = await loadAgent('test-missing', async () => {
        throw new Error('Cannot find module \'@sepveneto/dnde-agent\'')
      })

      assert.equal(result, false)
      assert.equal(calls.length, 1)
      assert.match(String(calls[0]![0]), /@sepveneto\/dnde-agent/)
      assert.match(String(calls[0]![0]), /register\(/)
    }
    finally {
      restore()
    }
  })

  it('失败不缓存，补上依赖后可重新加载成功', async () => {
    const registry = installFakeWindow()
    const { restore } = captureConsoleError()
    try {
      const first = await loadAgent('test-retry', async () => {
        throw new Error('missing')
      })
      assert.equal(first, false)

      const second = await loadAgent('test-retry', async () => {
        registry.set('test-retry', function Agent() {})
        return {}
      })
      assert.equal(second, true)
    }
    finally {
      restore()
    }
  })
})
