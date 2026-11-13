/* eslint-disable test/no-import-node-test */
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getLinkedSchemaItems,
  getSchemaValue,
  setSchemaValue,
} from '../lib/schemaPath.ts'

describe('schema path', () => {
  it('读取任意层级的值且不修改配置数据', () => {
    const data = {
      layout: {
        title: {
          color: '#fff',
        },
      },
    }
    const before = JSON.parse(JSON.stringify(data))

    assert.equal(getSchemaValue(data, 'layout.title.color'), '#fff')
    assert.equal(getSchemaValue(data, 'layout.missing.color'), undefined)
    assert.deepEqual(data, before)
  })

  it('写入时自动补齐对象层级', () => {
    const data: Record<string, any> = {}

    setSchemaValue(data, 'layout.title.color', '#000')

    assert.deepEqual(data, {
      layout: {
        title: {
          color: '#000',
        },
      },
    })
  })

  it('联动配置通过嵌套 key 匹配当前值', () => {
    const linkedItem = {
      type: 'input',
      label: '图片地址',
      key: 'image.url',
    } as SchemaItem
    const config = {
      type: 'select',
      label: '布局',
      key: 'layout.type',
      link: {
        image: [linkedItem],
      },
    } as SchemaItem

    assert.deepEqual(
      getLinkedSchemaItems(config, { layout: { type: 'image' } }),
      [linkedItem],
    )
    assert.deepEqual(getLinkedSchemaItems(config, { layout: { type: 'text' } }), [])
  })
})
