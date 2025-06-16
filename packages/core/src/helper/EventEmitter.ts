type CallbackFn = (...args: any[]) => void

export class EventEmitter {
  public notify: CallbackFn
  public events: Map<string, CallbackFn[]>
  constructor(subscribeFn: CallbackFn) {
    this.events = new Map()
    this.notify = subscribeFn
  }

  on(event: string, callback: CallbackFn) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)?.push(callback)
  }

  emit(event: string, ...args: any[]) {
    this.notify(event, ...args)

    if (this.events.has(event)) {
      this.events.get(event)?.forEach((callback) => {
        callback(...args)
      })
    }
  }

  off(event: string, callback: CallbackFn) {
    if (this.events.has(event)) {
      this.events.set(event, this.events.get(event)?.filter(cb => cb !== callback) || [])
    }
  }

  clear() {
    this.events.clear()
  }
}
