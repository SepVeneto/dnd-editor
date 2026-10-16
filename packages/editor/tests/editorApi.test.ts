import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bindEditorApi,
  invokeEditorApi,
} from '../lib/api.ts'

/** 最小的「元素」替身：指令式 API 的实现与队列都挂在它上面 */
function makeHost() {
  return {} as any
}

describe('invokeEditorApi', () => {
  it('编辑器已挂载时直接执行', () => {
    const host = makeHost()
    const calls: string[] = []
    bindEditorApi(host, {
      register: () => calls.push('register'),
      validate: () => 'valid',
      getData: () => ({ list: [] }),
      setData: (data: any) => calls.push(`setData:${data}`),
    })

    assert.deepEqual(invokeEditorApi(host, 'getData', []), { list: [] })
    invokeEditorApi(host, 'setData', ['page'])
    assert.deepEqual(calls, ['setData:page'])
  })

  it('挂载前先排队，挂载后按顺序补上（返回值是 Promise）', async () => {
    const host = makeHost()
    const calls: string[] = []

    const first = invokeEditorApi(host, 'setData', ['a'])
    const second = invokeEditorApi(host, 'setData', ['b'])
    assert.equal(first instanceof Promise, true)
    assert.equal(second instanceof Promise, true)
    assert.equal(calls.length, 0)

    bindEditorApi(host, {
      register: () => {},
      validate: () => {},
      getData: () => ({}),
      setData: (data: any) => {
        calls.push(data)
        return data
      },
    })

    assert.deepEqual(calls, ['a', 'b'])
    assert.equal(await first, 'a')
    assert.equal(await second, 'b')
    // 补完之后应当走真实实现，而不是继续排队
    invokeEditorApi(host, 'setData', ['c'])
    assert.deepEqual(calls, ['a', 'b', 'c'])
  })

  it('补调用时抛出的异常转交给排队时返回的 Promise', async () => {
    const host = makeHost()
    const pending = invokeEditorApi(host, 'validate', [])

    bindEditorApi(host, {
      register: () => {},
      validate: () => {
        throw new Error('验证未通过')
      },
      getData: () => ({}),
      setData: () => {},
    })

    await assert.rejects(pending, /验证未通过/)
  })

  it('非元素（未渲染的 ref）直接返回 undefined', () => {
    assert.equal(invokeEditorApi(undefined, 'getData', []), undefined)
    assert.equal(invokeEditorApi(null, 'setData', [{}]), undefined)
  })
})

describe('bindEditorApi', () => {
  it('先 bind 再调用不会被重复排队', () => {
    const host = makeHost()
    let count = 0
    const api = {
      register: () => {},
      validate: () => {},
      getData: () => ({}),
      setData: () => {
        count++
      },
    }
    bindEditorApi(host, api)
    bindEditorApi(host, api)
    invokeEditorApi(host, 'setData', [{}])
    assert.equal(count, 1)
  })
})
