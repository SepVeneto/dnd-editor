import type { IWidget } from '@/types'

export enum type {
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
  attributes?: IWidget['schema']['props']
  stylesheet?: IWidget['schema']['style']
}

interface ColumnContainerWidget {
  name?: IWidget['_name']
  icon?: IWidget['_icon']
  config?: IWidget['meta']
  defaultStyle?: IWidget['style']
  attributes?: IWidget['schema']['props']
  stylesheet?: IWidget['schema']['style']
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
    }
  },
  group(name: string, list: IWidget[]) {
    return {
      type: type.GROUP,
      name,
      list,
    }
  },
}
