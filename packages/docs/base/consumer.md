---
title: 消费者
---

# 消费者

消费者由宿主引入，是用户交互的主要区域。

## 属性

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| ---- | --- | ---- | ----- | ---- |
| remoteUrl | string | √ | - | 视图的远程地址 |
| name | string | × | widgets | 视图的名称，这里用于删除缓存 |
| widgets | LikeWidget[] | × | [] | 组件区中展示的组件 |
| extra | Object | × | {} | 宿主中需要传递给编辑器的数据 |

## 事件

| 名称 | 参数 | 说明 |
| :--- | :-- | :--- |
| onChange | <Desc desc="any">data</Desc> | 配置区/编辑区数据变化时触发 |

## 方法

| 名称 | 类型 | 说明 |
| :--- | :-- | :--- |
| register | <Desc desc="(fn: (ctx: Editor) => void) => { init: () => void }">Function</Desc> | 注册扩展 |
| validate | <Desc desc="() => Promise<void>" :raw="false">Function</Desc> | 验证配置区数据 |
| getData | <Desc desc="() => any">Function</Desc> | 获取编辑区的数据 |
| setData | <Desc desc="(data: any) => void">Function</Desc> | 设置编辑区的数据 |
