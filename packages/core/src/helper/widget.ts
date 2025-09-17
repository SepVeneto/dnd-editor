import type { SchemaItem } from '@/class'
import type { IWidget } from '@/types'

export enum widgetType {
  WIDGET,
  GROUP,
}

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

interface RootWidget {
  name?: IWidget['_name']
  defaultData?: IWidget['data']
  defaultStyle?: IWidget['style']
  attributes?: SchemaItem[]
  stylesheet?: SchemaItem[]
}

interface ColumnContainerWidget {
  name?: IWidget['_name']
  icon?: IWidget['_icon']
  config?: IWidget['meta']
  defaultStyle?: IWidget['style']
  attributes?: SchemaItem[]
  stylesheet?: SchemaItem[]
}

export const widget = {
  columnContainer(config: ColumnContainerWidget): IWidget {
    return {
      _name: config.name || '栅格容器',
      _view: 'containerGrid',
      _icon: config.icon,
      container: true,
      meta: config.config,
      style: config.defaultStyle,
      schema: {
        props: config.attributes,
        style: config.stylesheet,
      },
    }
  },
  create(config: CWidget) {
    return {
      _name: config.name,
      _view: config.type,
      _icon: config.icon,
      container: config.isContainer,
      meta: config.config,
      schema: {
        props: config.attributes,
        style: config.stylesheet,
      },
      style: config.defaultStyle,
      data: config.defaultData,
    }
  },
  group(name: string, list: IWidget[]) {
    return {
      type: widgetType.GROUP,
      name,
      list,
    }
  },

  widget(name: string, list: IWidget[]) {
    return {
      type: widgetType.WIDGET,
      name,
      list,
    }
  },
  root(config: RootWidget) {
    return this.create({
      name: config.name || '页面',
      type: 'page',
      config: { visible: false },
      defaultData: config.defaultData,
      defaultStyle: config.defaultStyle,
      attributes: config.attributes,
      stylesheet: config.stylesheet,
    })
  },
}
