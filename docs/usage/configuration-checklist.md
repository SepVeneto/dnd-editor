# 配置清单初始化

当前阶段只实现配置清单驱动的初始化，不解析参考图。链路固定为：

```text
配置清单
  -> 初始化 IR
  -> 宿主按资源类型严格查询
  -> 受控 DSL
  -> 确定性校验
  -> 原子应用 / revision / 撤销点
```

`IR.components` 的数组顺序就是页面组件顺序，不再保存
`placement/afterKey/beforeKey/group` 字段。初始化 DSL 的 `add` 操作也按同一顺序
生成，不重复声明位置。

IR 资源只需声明归属组件、枚举类型、是否必填和查询文本：

```json
{
  "component": "entry-grid",
  "type": "app",
  "required": true,
  "query": "叮咚买菜"
}
```

`type` 固定为 `link | app | coupon`。宿主为每个组件位置生成唯一 `locationId`；资源声明和查询结果都通过该 ID 关联，不使用业务实体 ID。

## 通用编辑器职责

- `createCapabilityCatalog()` 将组件标准 props、`schema.custom` 类型和宿主外部能力注册表组合标准化，不读取组件上的 capability，也不包含资源槽位。
- `normalizeInitializationIr()` 固定 IR 字段，丢弃模型写入的 `id` / `sources` / `hint` / `classification` / `resolution`。
- `validateEditorDsl()` 校验 revision、scope、标准字段、custom capability 和资源查询引用。
- `applyDsl()` 在编辑器内原子执行，失败时恢复应用前快照；`undo()` 按 revision 恢复。

IR 是提供给模型的规划上下文，用来帮助模型选择组件并准确调用 DSL 工具；宿主不会用 IR 强制 DSL 的组件顺序、覆盖范围或资源使用。

## 业务宿主职责

业务查询工具由宿主使用 `defineAgentTool` 显式注册，不放在通用 Agent 内：

```js
const queryAppResources = defineAgentTool({
  name: 'query_app_resources',
  description: '严格查询 IR 中的 app 资源',
  inputSchema: z.object({ queries: z.array(z.string()).min(1) }),
  execute: ({ queries }, { context }) => queryResources('app', queries, context),
})
```

宿主将 `query_app_resources`、`query_coupon_resources`、`query_link_resources`
这三个工具通过 `agentTools` 注入编辑器 Agent。`prepare_initialization` 规范化 IR、为每个组件位置生成唯一 `locationId`，但不执行业务查询。

配置清单子 Agent 也由宿主提供，编辑器只提供主 Agent。宿主通过 `subAgents` 或
`agent-sub-agents` 注册子 Agent 的规则和业务工具，编辑器会自动补充编辑器工具并建立
主 Agent 与子 Agent 之间的 handoff：

```ts
const configurationChecklistAgent = {
  name: 'Configuration Checklist Agent',
  handoffDescription: '处理配置清单、需求文档和多组件配置请求。',
  handoffToolName: 'handle_configuration_checklist',
  instructions: `你负责把配置清单转换为 IR，并按宿主查询结果调用编辑器 DSL。完成后调用 return_to_main_agent。`,
}
```

解析器必须返回：

```ts
{
  status: 'ready' | 'hold' | 'unresolved'
  resources: Array<{
    status: 'resolved' | 'not_found' | 'ambiguous' | 'unavailable'
    type: 'link' | 'app' | 'coupon'
    query: string
    value?: unknown
    sourceTool?: string
    underlyingId?: string
  }>
  conflicts: unknown[]
  unresolved: unknown[]
  ignored: unknown[]
}
```

宿主按资源 `type` 调用对应查询工具，采用严格匹配。查询结果按位置和资源类型写入：

```ts
context.initialization.locations[locationId].resources[type] = Resource[]
```

模型只看到 `locationId / component / type / query / status`；原始业务对象保留在 Context。`add_editor_node` 只传入 `resourceId`（值为 IR 的 `locationId`）和完整 Context，宿主从位置记录读取 widget、标准 props 和资源。

## 配置清单分类

- `H5 外接场景`：每项作为 `app` 资源查询。
- `卡券品牌`：每项作为 `coupon` 资源查询；卡片名称、面值、手续费等明细不进入入口资源。
- `门店提货/扫码提货`：只判断该配置段落是否存在。存在时生成
  `type: "shopPickup"` 的组件，忽略其品牌、适用范围等内容，不创建资源。

## Agent 工具顺序

宿主提供的配置清单 Agent 必须按以下顺序调用：

1. `get_current_editor`
2. `get_widgets`
3. `prepare_initialization`
4. 按 IR 资源类型调用 `query_app_resources` / `query_coupon_resources` / `query_link_resources`
5. `add_editor_node`，按 IR components 顺序每次添加一个组件

编辑或删除已有节点时分别调用 `update_editor_node`、`delete_editor_node`。模型直接调用编辑器 DSL 工具，不再使用一次性批量应用工具。

所有写工具（`add_editor_node`、`update_editor_node`、`delete_editor_node`）都要求当前 Run 的 Context 已包含
`initialization.ir`。没有先生成 IR 时，工具直接拒绝执行，宿主编辑器 API
也会拒绝写入。

资源查询工具发现冲突时 Context 状态变为 `hold`，本批不得写入。required 资源 `not_found` 标记为 unresolved；`ambiguous` 和 `unavailable` 均暂停，不使用静态回退。

`add_editor_node` 的模型参数只有 `resourceId`。工具以
`(node, { locationId, componentKey }, context)` 调用宿主 UPDATE 函数；UPDATE
通过 `context.initialization.locations[locationId]` 同时读取标准 props 和已查询资源。
