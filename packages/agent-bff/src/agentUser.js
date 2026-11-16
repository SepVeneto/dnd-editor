import {
  normalizeNamespace,
  normalizeUserIdentity,
} from './conversationStore.js'

export function requireAgentUser(req, res, next) {
  const userId = normalizeUserIdentity(req.get('agent-user-id'))
  if (!userId) {
    console.warn('[agent-bff] 缺少有效的 Agent-User-Id 请求头', {
      method: req.method,
      path: req.path,
    })
    res.status(401).json({
      code: 1,
      msg: '未授权访问',
    })
    return
  }

  res.locals.agentUser = {
    userId,
    namespace: normalizeNamespace(req.get('x-agent-namespace')),
  }
  next()
}
