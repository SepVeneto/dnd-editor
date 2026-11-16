/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { providerStreamErrorMessage } from '../src/runtimeErrors.ts'

function failedResponseEvent(message: string) {
  return {
    type: 'model',
    event: {
      type: 'response.failed',
      response: {
        status: 'failed',
        error: {
          code: 'server_error',
          message,
        },
      },
    },
  }
}

describe('agent runtime model errors', () => {
  it('保留 Responses API 返回的模型错误', () => {
    assert.equal(
      providerStreamErrorMessage(failedResponseEvent('Model not found: deepseek-flash')),
      'Model not found: deepseek-flash',
    )
  })

  it('保留额度耗尽等服务端错误', () => {
    assert.equal(
      providerStreamErrorMessage(
        failedResponseEvent('Free quota exhausted.'),
      ),
      'Free quota exhausted.',
    )
  })

  it('忽略普通模型输出事件', () => {
    assert.equal(
      providerStreamErrorMessage({
        type: 'model',
        event: { type: 'response.output_text.delta', delta: 'OK' },
      }),
      undefined,
    )
  })
})
