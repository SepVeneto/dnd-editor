// server.ts
import express from 'express'
import cors from 'cors'
import multer from 'multer'

import mammoth from 'mammoth'
import TurndownService from 'turndown'
import turndownPluginGfm from 'turndown-plugin-gfm'

const app = express()

const upload = multer({
  dest: './uploads/',
  defParamCharset: 'utf8',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

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

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ code: 0, msg: 'success', data: {
    name: req.file.filename,
    file: req.file.originalname,
  }
  })
})


app.get('/health', (_, res) => {
  res.json({ status: 'ok' })
})

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})
turndown.use(turndownPluginGfm.gfm)

async function docx2markdown(input) {
  const source = Buffer.isBuffer(input)
    ? { buffer: input }
    : { path: input }

  const result = await mammoth.convertToHtml(source)

  for (const message of result.messages) {
    if (message.type === 'warning') {
      console.warn('[DOCX warning]', message.message);
    }
  }

  return turndown.turndown(result.value)
}

app.get('/docx-markdown', async (req, res) => {
  const _res = await docx2markdown(`./uploads/${req.query.id}`)
  res.json({ code: 0, data: _res })
})

app.listen(PORT, () => {
  console.log(`LLM proxy listening on :${PORT}`)
})