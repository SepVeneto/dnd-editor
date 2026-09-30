import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://llm-29a9b93te5uwccoz.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
  apiKey: 'sk-ws-H.PRHEMYL.2Y1l.MEUCIQDmd_SSyF-wN4Y7YOEOV2Xxzak91U-tlE89SHHyGvk8bAIgV2HROXyaTvzeGB9Ks3St2EkzoGnJ6t1cXgggcK8T9iQ'
})


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
  protected _client: OpenAI

  constructor(client: OpenAI) {
    this._client = client
  }
  async *getStreamedResponse(request: ModelRequest) {
    try {
      const response = await this._fetchResponse(request)
    }
  }

  _fetchResponse(request: ModelRequest) {
    const builtRequest = this._createRequest(request)

    const responsePromis = this._client.responses.create(
      builtRequest.requestData
    )
  }

  _createRequest(request: ModelRequest) {
    return {
      requestData: {
        input: 
      }
    }
  }
}

