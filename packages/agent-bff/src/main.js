// server.ts
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import mammoth from 'mammoth'
import multer from 'multer'
import TurndownService from 'turndown'
import turndownPluginGfm from 'turndown-plugin-gfm'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const uploadsDir = resolve(packageDir, 'uploads')
mkdirSync(uploadsDir, { recursive: true })

/**
 * 轻量加载 .env 文件，避免引入额外依赖。
 * 已存在的 process.env 优先，方便用命令行变量覆盖本地配置。
 */
function loadEnvFile(file) {
  if (!existsSync(file)) {
    return
  }

  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/)
    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) {
      continue
    }

    let value = rawValue.trim()
    if (value.startsWith('"') || value.startsWith('\'')) {
      const quote = value[0]
      const end = value.indexOf(quote, 1)
      value = end === -1 ? value.slice(1) : value.slice(1, end)
    }
    else {
      const commentIndex = value.indexOf(' #')
      value = (commentIndex === -1 ? value : value.slice(0, commentIndex)).trim()
    }

    process.env[key] = value
  }
}

// 本地开发：优先读取 agent-bff 目录下的 .env.local / .env。
for (const file of [
  resolve(packageDir, '.env.local'),
  resolve(packageDir, '.env'),
]) {
  loadEnvFile(file)
}

const app = express()

const upload = multer({
  dest: uploadsDir,
  defParamCharset: 'utf8',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter(_req, file, callback) {
    if (!file.originalname.toLowerCase().endsWith('.docx')) {
      callback(new Error('目前仅支持上传 .docx 文档'))
      return
    }
    callback(null, true)
  },
})

app.use(cors({
  origin: '*',
  // [
  //   // 'http://localhost:8083',
  //   // 'http://localhost:4000',
  // ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: '*',
}))

app.use(express.json({ limit: '10mb' }))

const PORT = Number(process.env.PORT ?? 4000)
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'https://llm-29a9b93te5uwccoz.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
const LLM_API_KEY = process.env.LLM_API_KEY

if (!LLM_API_KEY) {
  throw new Error('LLM_API_KEY is required: add it to packages/agent-bff/.env.local')
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
    data: [{id: 1, name: '叮咚买菜', status: true }, { id: 2, name: '大润发', status: false }],
    msg: ''
  }))
})

app.post('/v1/business/scene', async (req, res) => {
  res.send(JSON.stringify({ code: 0, success: '开通成功' }))
})

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ code: 1, msg: '请选择要上传的文档' })
    return
  }

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
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id || basename(id) !== id) {
      res.status(400).json({ code: 1, msg: '无效的文档 ID' })
      return
    }

    const markdown = await docx2markdown(resolve(uploadsDir, id))
    res.json({ code: 0, data: markdown })
  }
  catch (error) {
    console.error(error)
    res.status(500).json({ code: 1, msg: '文档解析失败' })
  }
})

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? '文档不能超过 10 MB'
      : error.message
    res.status(400).json({ code: 1, msg: message })
    return
  }
  if (error?.message === '目前仅支持上传 .docx 文档') {
    res.status(400).json({ code: 1, msg: error.message })
    return
  }
  next(error)
})

app.listen(PORT, () => {
  console.log(`LLM proxy listening on :${PORT}`)
})
