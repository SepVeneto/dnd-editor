
export type ModelRequest = {
  input: string
}

export type ModelResponse = {
  output: unknown[]
}

export type Model = {
  getResponse(request: ModelRequest): Promise<ModelResponse>

  getStreamedResponse(request: ModelRequest): AsyncIterable<unknown>
}

export class QwenResponseModel implements Model {
  async *getStreamedResponse(request: ModelRequest) {
    try {
      
    }
  }
}

