declare module 'vue' {
  export interface GlobalComponents {
    MpdEditor: typeof import('@sepveneto/dnde')['Editor']
  }
}

export {}
