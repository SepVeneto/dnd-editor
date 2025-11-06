# 组件

## 创建

```ts
import { schema, widget } from '@sepveneto/dnde-core'

const input = schema.input({
  label: '标题',
  key: 'title',
})
const richText = schema.custom({
  type: 'richText',
  label: '内容',
  key: 'content',
})

const card = widget.create({
  name: '卡片',
  type: 'card',
  config: {
    fixed: true,
    draggable: false,
    visible: false,
  },
  defaultData: {
    isShow: 1,
  },
  defaultStyle: {
    width: 375,
    height: 100,
  },
  attributes: [
    input,
    richText,
  ]
})
```

这是一个典型的用于编辑器的组件创建。通过`widget.create`可以创建一个基本的组件，向其中传递的对象可以进一步设置组件在组件区中显示的名称和图标，在编辑区中所使用的视图的名称以及选中后在配置区可自定义的内容。

## 类型声明

```ts
interface CWidget {
  name: IWidget['_name']
  type: IWidget['_view']
  icon?: IWidget['_icon']
  config?: IWidget['meta']
  isContainer?: IWidget['container']
  defaultStyle?: IWidget['style']
  defaultData?: Record<string, any>
  attributes?: SchemaItem[]
  stylesheet?: SchemaItem[]
}
```
