// server.ts
import express from 'express'
import cors from 'cors'

const app = express()

app.use(cors({
  origin: '*',
  // [
  //   // 'http://localhost:8083',
  //   // 'http://localhost:4000',
  // ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: '*',
}))

app.use(express.json({ limit: '10mb' }))

const PORT = Number(process.env.PORT ?? 4000)
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'https://llm-29a9b93te5uwccoz.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
const LLM_API_KEY = process.env.LLM_API_KEY ?? 'sk-ws-H.PRIYDPY.6pkt.MEUCIQCzDiHwSrcrpVm52eQVC8h5Sq-2bo6nskePEPctk1R9bQIgeN9sgI1WspsHA2VE7-4rsSV7RsWN_3Q3QhO_yhllwfY'

if (!LLM_API_KEY) {
  throw new Error('LLM_API_KEY is required')
}

app.post('/v1/responses', async (req, res) => {
  try {
    const response = await fetch(`${LLM_BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    })
    console.log(response.status)

    res.status(response.status)

    const contentType = response.headers.get('content-type')
    if (contentType) {
      res.setHeader('content-type', contentType)
    }

    // 支持普通响应，也支持 stream
    if (req.body.stream) {
      response.body?.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(Buffer.from(chunk))
          },
          close() {
            res.end()
          },
          abort() {
            res.end()
          },
        }),
      )
    } else {
      const body = await response.text()
      res.send(body)
    }
  } catch (error) {
    console.error(error)

    if (!res.headersSent) {
      res.status(502).json({
        error: {
          message: 'LLM proxy request failed',
        },
      })
    }
  }
})

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    })

    res.status(response.status)

    const contentType = response.headers.get('content-type')
    if (contentType) {
      res.setHeader('content-type', contentType)
    }

    // 支持普通响应，也支持 stream
    if (req.body.stream) {
      response.body?.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(Buffer.from(chunk))
          },
          close() {
            res.end()
          },
          abort() {
            res.end()
          },
        }),
      )
    } else {
      const body = await response.text()
      res.send(body)
    }
  } catch (error) {
    console.error(error)

    if (!res.headersSent) {
      res.status(502).json({
        error: {
          message: 'LLM proxy request failed',
        },
      })
    }
  }
})

app.get('/v1/business/scenes', async (req, res) => {
  res.send(JSON.stringify({
    code: 0,
    data: [{id: 1, name: '叮咚买菜', status: true }, { id: 2, name: '大润发小时达', status: false }],
    msg: ''
  }))
})

app.post('/v1/business/scene', async (req, res) => {
  res.send(JSON.stringify({ code: 0, success: '开通成功' }))
})




app.get('/health', (_, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`LLM proxy listening on :${PORT}`)
})