/* eslint-disable test/no-import-node-test */
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applySchemaDefaults,
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

  it('只补齐旧数据缺失的 schema 默认值', () => {
    const data = {
      title: '已有标题',
      enabled: false,
      layout: {
        align: null,
      },
    }
    const configs = [
      { type: 'input', label: '标题', key: 'title', defaultValue: '默认标题' },
      { type: 'switch', label: '启用', key: 'enabled', defaultValue: true },
      { type: 'input', label: '副标题', key: 'subtitle', defaultValue: '' },
      { type: 'input', label: '对齐', key: 'layout.align', defaultValue: 'center' },
      { type: 'input', label: '间距', key: 'layout.gap', defaultValue: 0 },
      { type: 'input', label: '未设置默认值', key: 'empty' },
    ] as SchemaItem[]

    applySchemaDefaults(data, configs)

    assert.deepEqual(data, {
      title: '已有标题',
      enabled: false,
      subtitle: '',
      layout: {
        align: null,
        gap: 0,
      },
    })
  })

  it('为每个节点复制对象默认值', () => {
    const schema = [
      { type: 'input', label: '选项', key: 'options', defaultValue: { align: 'center' } },
    ] as SchemaItem[]
    const first = {}
    const second = {}

    applySchemaDefaults(first, schema)
    applySchemaDefaults(second, schema)
    ;(first as any).options.align = 'left'

    assert.equal((second as any).options.align, 'center')
    assert.equal((schema[0] as any).defaultValue.align, 'center')
  })

  it('只为当前命中的联动配置补齐默认值', () => {
    const linked = {
      type: 'input',
      label: '图片地址',
      key: 'image.url',
      defaultValue: '/default.png',
    } as SchemaItem
    const config = {
      type: 'select',
      label: '布局',
      key: 'layout',
      link: {
        image: [linked],
      },
    } as SchemaItem

    const imageData = { layout: 'image' }
    const textData = { layout: 'text' }

    applySchemaDefaults(imageData, [config])
    applySchemaDefaults(textData, [config])

    assert.deepEqual(imageData, {
      layout: 'image',
      image: { url: '/default.png' },
    })
    assert.deepEqual(textData, { layout: 'text' })
  })
})
