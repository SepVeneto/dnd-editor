# agent-bff

Agent BFF 负责代理模型请求、处理附件，并在 PostgreSQL 中保存按用户隔离的会话历史。

## 启动

复制 `.env.example` 为 `.env`，配置 `LLM_API_KEY`。使用仓库根目录的
`pnpm-lock.yaml` 安装依赖：

```bash
pnpm install --filter ./packages/agent-bff
pnpm -C packages/agent-bff dev
```

开发环境需要一个可访问的 PostgreSQL，并通过 `DATABASE_URL` 指定连接串。容器镜像已经
内置 PostgreSQL 16，启动时会初始化数据库、等待数据库就绪并启动 BFF，会话表也会自动
创建；也可以手工执行 `migrations/001_agent_conversations.sql`。

使用 Compose 只启动一个镜像，PostgreSQL 和服务运行在同一容器中：

```bash
docker compose -f packages/agent-bff/compose.yaml up --build
```

`postgres-data` 卷保存数据库文件，`uploads` 卷保存上传附件。默认连接串为
`postgresql://agent_bff:agent_bff@127.0.0.1:5432/agent_bff`；生产环境应通过
`POSTGRES_PASSWORD` 和 `DATABASE_URL` 覆盖默认凭据。

使用 `./uploads:/app/packages/agent-bff/uploads` 这类宿主机 bind mount 时，目录属主会
原样映射进容器。入口脚本会在切换到 UID 10001 的 `app` 用户前，修正挂载点的属主和权限；
不要绕过该入口脚本直接启动 `node src/main.js`，否则需要自行保证宿主机目录可由 UID
10001 写入。

## 代理已部署的 BFF

前端使用 `http://localhost:4000/v1` 时，可以用开发代理连接已部署的 BFF，避免在本地
启动 PostgreSQL 和模型服务：

```bash
pnpm -C packages/agent-bff proxy:remote
```

代理会监听 `4000`，将请求原样转发到
`https://aibot.rxlpzj.com/diy-agent`。例如本地 `/v1/responses` 会转发到远端
`/diy-agent/v1/responses`，`/upload` 会转发到 `/diy-agent/upload`。可通过
`AGENT_BFF_UPSTREAM` 和 `PORT` 覆盖目标与监听端口。

该命令和本地 BFF 的 `dev` 命令都会占用 4000 端口，两者不能同时启动。

## 会话 API

会话接口通过宿主传入的 `Agent-User-Id` 标识用户，通过 `X-Agent-Namespace` 隔离不同 Agent
场景。生产部署应由可信网关写入或覆盖用户请求头，不能直接信任公网客户端提供的身份。

- `GET /v1/conversations`：最近的会话摘要
- `GET /v1/conversations/:id`：会话及其消息
- `PUT /v1/conversations/:id`：创建或更新会话

写入接口会在会话 ID 已属于其他用户或命名空间时返回 `409`，不会覆盖已有会话。
