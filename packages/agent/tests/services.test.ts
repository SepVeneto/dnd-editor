/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildAgentUserContent,
  getAgentFileKind,
  isAgentImageFilePart,
} from '../src/services.ts'

describe('multimodal attachments', () => {
  it('识别文档和千问支持的图片格式', () => {
    assert.equal(getAgentFileKind({
      name: 'layout.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }), 'document')
    assert.equal(getAgentFileKind({
      name: 'layout.PNG',
      type: 'image/png',
    }), 'image')
    assert.equal(getAgentFileKind({
      name: 'layout.webp',
      type: '',
    }), 'image')
    assert.equal(getAgentFileKind({
      name: 'notes.txt',
      type: 'text/plain',
    }), undefined)
  })

  it('兼容旧会话中没有 kind 的图片附件', () => {
    assert.equal(isAgentImageFilePart({
      type: 'file',
      name: 'upload-id',
      file: 'layout.png',
      mimeType: 'image/png',
    }), true)
  })

  it('按千问格式先发送图片 Data URL，再发送布局指令', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
    assert.deepEqual(
      buildAgentUserContent('参考图片布局', [dataUrl]),
      [
        {
          type: 'input_image',
          image: dataUrl,
          detail: 'high',
        },
        {
          type: 'input_text',
          text: '参考图片布局',
        },
      ],
    )
  })

  it('一次请求可以携带多张图片', () => {
    const first = 'data:image/png;base64,AAAA'
    const second = 'data:image/jpeg;base64,BBBB'
    assert.deepEqual(
      buildAgentUserContent('综合参考', [first, second]),
      [
        { type: 'input_image', image: first, detail: 'high' },
        { type: 'input_image', image: second, detail: 'high' },
        { type: 'input_text', text: '综合参考' },
      ],
    )
  })

  it('纯文本消息保持字符串输入', () => {
    assert.equal(buildAgentUserContent('生成首页', []), '生成首页')
  })
})
