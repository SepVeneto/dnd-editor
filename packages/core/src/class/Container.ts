import type { IWidget } from '@/types'
import { Widget } from './Widget'

export class Container extends Widget {
  constructor(data: IWidget<object>) {
    super(data)
    this.type = 'container'
  }
}
