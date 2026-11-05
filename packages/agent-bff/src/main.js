// server.ts
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import process from 'node:process'
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

const AGENT_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024
const AGENT_IMAGE_MAX_SIZE = 10 * 1024 * 1024
const imageExtensions = new Set([
  '.bmp',
  '.heic',
  '.jpe',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
])
const imageMimeTypes = new Set([
  'image/bmp',
  'image/heic',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
])

function fileExtension(name) {
  const match = name.toLowerCase().match(/\.[^.]+$/)
  return match?.[0] ?? ''
}

function getUploadKind(file) {
  if (fileExtension(file.originalname) === '.docx') {
    return 'document'
  }

  if (
    imageExtensions.has(fileExtension(file.originalname))
    || imageMimeTypes.has(file.mimetype?.toLowerCase())
  ) {
    return 'image'
  }

  return undefined
}

function detectImageMime(buffer) {
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([
      0x89,
      0x50,
      0x4E,
      0x47,
      0x0D,
      0x0A,
      0x1A,
      0x0A,
    ]))
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 3
    && buffer[0] === 0xFF
    && buffer[1] === 0xD8
    && buffer[2] === 0xFF
  ) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (
    buffer.length >= 2
    && buffer.subarray(0, 2).toString('ascii') === 'BM'
  ) {
    return 'image/bmp'
  }
  if (
    buffer.length >= 4
    && (
      buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2A, 0x00]))
      || buffer.subarray(0, 4).equals(Buffer.from([0x4D, 0x4D, 0x00, 0x2A]))
    )
  ) {
    return 'image/tiff'
  }
  if (
    buffer.length >= 12
    && buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    && ['heic', 'heix', 'hevc', 'mif1'].includes(
      buffer.subarray(8, 12).toString('ascii'),
    )
  ) {
    return 'image/heic'
  }
  return undefined
}

function readUploadedImage(id) {
  const buffer = readFileSync(resolve(uploadsDir, id))
  const mimeType = detectImageMime(buffer)
  if (!mimeType)
    throw new Error('上传文件不是支持的图片格式')
  return { buffer, mimeType }
}

const upload = multer({
  dest: uploadsDir,
  defParamCharset: 'utf8',
  limits: {
    fileSize: Math.max(AGENT_DOCUMENT_MAX_SIZE, AGENT_IMAGE_MAX_SIZE),
  },
  fileFilter(_req, file, callback) {
    if (!getUploadKind(file)) {
      callback(new Error('目前支持 .docx 文档及 JPG、PNG、WebP 等图片'))
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

// Base64 images expand by roughly one third. This leaves room for the
// 20 MB attachment budget plus conversation history while staying bounded.
app.use(express.json({ limit: '35mb' }))

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
        'Authorization': `Bearer ${LLM_API_KEY}`,
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
    }
    else {
      const body = await response.text()
      res.send(body)
    }
  }
  catch (error) {
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
        'Authorization': `Bearer ${LLM_API_KEY}`,
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
    }
    else {
      const body = await response.text()
      res.send(body)
    }
  }
  catch (error) {
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
    data: [{ id: 1, name: '叮咚买菜', status: true }, { id: 2, name: '大润发', status: false }],
    msg: '',
  }))
})

app.post('/v1/business/scene', async (req, res) => {
  res.send(JSON.stringify({ code: 0, success: '开通成功' }))
})

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ code: 1, msg: '请选择要上传的文件' })
    return
  }

  const kind = getUploadKind(req.file)
  if (!kind) {
    res.status(400).json({ code: 1, msg: '不支持该文件类型' })
    return
  }
  const maxSize = kind === 'image'
    ? AGENT_IMAGE_MAX_SIZE
    : AGENT_DOCUMENT_MAX_SIZE
  if (req.file.size > maxSize) {
    res.status(400).json({
      code: 1,
      msg: `${kind === 'image' ? '图片' : '文档'}不能超过 10 MB`,
    })
    return
  }

  res.json({
    code: 0,
    msg: 'success',
    data: {
      name: req.file.filename,
      file: req.file.originalname,
      kind,
      mimeType: req.file.mimetype,
    },
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
      console.warn('[DOCX warning]', message.message)
    }
  }

  return turndown.turndown(result.value)
}

app.get('/image', (req, res) => {
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id || basename(id) !== id) {
      res.status(400).json({ code: 1, msg: '无效的图片 ID' })
      return
    }

    const { buffer, mimeType } = readUploadedImage(id)
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.send(buffer)
  }
  catch (error) {
    console.error(error)
    res.status(404).json({ code: 1, msg: '图片不存在或格式不受支持' })
  }
})

app.get('/image-data', (req, res) => {
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id || basename(id) !== id) {
      res.status(400).json({ code: 1, msg: '无效的图片 ID' })
      return
    }

    const { buffer, mimeType } = readUploadedImage(id)
    res.json({
      code: 0,
      data: `data:${mimeType};base64,${buffer.toString('base64')}`,
    })
  }
  catch (error) {
    console.error(error)
    res.status(404).json({ code: 1, msg: '图片不存在或格式不受支持' })
  }
})

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
      ? '文件不能超过 10 MB'
      : error.message
    res.status(400).json({ code: 1, msg: message })
    return
  }
  if (error?.message === '目前支持 .docx 文档及 JPG、PNG、WebP 等图片') {
    res.status(400).json({ code: 1, msg: error.message })
    return
  }
  next(error)
})

app.listen(PORT, () => {
  console.log(`LLM proxy listening on :${PORT}`)
})
