import { Model } from "./model";

export interface RunConfig {
  model: Model
}

export class Runner {
  public config: RunConfig

  constructor() {
    this.config = {
      model: 
    }
  }

  private async runStreamLoop() {
    try {
      while (true) {
        try {
          const streamedResponse = t
          // for await (const event of ) {}
        } catch (e) {
          console.error(e)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }
}

export function run() {
  const runner = new Runner()
}