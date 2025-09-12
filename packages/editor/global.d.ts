import type Editor from '@sepveneto/dnde/editor'

declare module 'vue' {
  export interface GlobalComponents {
    MpdEditor: Editor
  }
}

export {}
