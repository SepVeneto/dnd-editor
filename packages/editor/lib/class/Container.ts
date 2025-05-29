import type { IWidget } from '@sepveneto/dnde-core'
import { Widget } from './Widget'

export class Container extends Widget {
  constructor(data: IWidget<object>) {
    super(data)
    this.type = 'container'
  }
}
