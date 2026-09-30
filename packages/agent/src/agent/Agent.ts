import { ref, shallowRef, ShallowRef, triggerRef } from "vue"
import { ThreadMessage } from "./type"


export class Agent {
  public runtime: Runtime

  constructor() {
    this.runtime = new Runtime()
  }
}

class Runtime {
  public messages = shallowRef<ThreadMessage[]>([])
  public isRunning = ref(false)
  run(input: string) {
    this.messages.value.push({
      id: createId(),
      role: 'user',
      parts: [
        { type: 'text', text: input }
      ]
    })

    triggerRef(this.messages)

    this.isRunning.value = true
  }

  private _run() {

  }
}

function createId(): string {
  return Math.random().toString(36).slice(2, 10)
}
