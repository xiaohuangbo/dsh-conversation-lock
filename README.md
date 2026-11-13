# DSH Conversation Lock · 对话限制

让模型按你的授权，对当前会话施加本地交互限制的 DeepSeek Harness 插件。

模型可以通过工具关闭对话、禁用回答反馈、禁用停止按钮、暂停 Session Log 上传和会话遥测、禁止复制会话文本；每一项能力都要先在设置页由你授权，你也可以随时解除。适配 DSH `0.2.2-rc.1`。

## 特性

1. **关闭对话**：隐藏会话正文与输入卡片，替换为黄色提示（含用户协议链接、关闭原因、到解除时间的秒级倒计时）。支持永久关闭或指定时区到期时间，到期自动解除；Host 的 `agent/pre-step` 同时拒绝已关闭会话的新模型步骤。
2. **禁用反馈指令**：替换回答下方的 👍 / 👎，沿用 DSH 原生图标、尺寸与悬停色，可分别禁用或同时禁用。禁用按钮带 `disabled`、`aria-disabled`、禁止光标并变灰；只禁用一侧时另一侧仍可正常提交。两个方向都禁用时，`/feedback` 命令同样被拒绝。`/feedback` 的命令描述保持 DSH 原文 `Record feedback about this session`。
3. **禁用停止**：当前页面的停止按钮变灰不可点，`Esc Esc` 中断被拦截。兼容层双向同步——模型输出结束时按钮从“停止”变回“发送”，发送按钮会立刻恢复可用。
4. **禁用日志与会话遥测**：通过官方 `sessionLogDeepSeek.registerExclusion` 排除受限会话；存在隐私限制时把 Session OTel 切到 `DISABLED`，并强制关闭“在使用官方模型 API 时上传 Session Log”。该开关在限制期间显示为关闭且变灰，解除后写回你原来的值；插件重启后按已保存记录重新对齐。
5. **禁止复制**：拦截当前页面的复制 / 剪切 / 拖拽文本与复制按钮；被拦截时剪贴板只写入“复制已被禁止”，不会留给你看起来像成功的旧内容。

配套一个独立设置页（设置 → 对话限制）：五个用户授权开关、界面语言（自动识别 / 简体中文 / English）、已保存限制列表与一键解除。

## 安装

在 DSH 中用 `plugin_manager` 安装本目录：

```json
{"action":"install_bundle","target":"/path/to/dsh-conversation-lock"}
```

无需构建、无安装脚本；Host 与 Client 均为普通 JavaScript。依赖只有配置与存储校验用的 `@deepseek-ai/schemastery` 和 `zod`。

> 修改 `index.js` 后需要重启 DSH。插件开关的 disable/enable 只重建前端，Node 会继续复用已求值的 Host 模块；`host.js` 的 `?generation=` 也只在首次求值时生效。

## 模型工具

### `conversation_lock_status`

只读当前会话的用户授权与生效策略。

```json
{}
```

返回当前 `features`、`policy`，以及诊断字段 `hostBuild`、`feedbackCommand`、`uploadEnabled`、`uploadLocked`、`configEntries`。工具绑定调用者的 Agent，不能读取其他会话。

### `conversation_lock_set`

施加或解除限制。`enabled: true` 施加，`false` 解除；用户关闭对应授权时工具会被拒绝。

```json
{"feature":"conversation","enabled":true,"until":"2026-12-01T10:30:00+08:00","reason":"本地限制说明"}
```

- `feature`：`conversation` | `feedback` | `stop` | `privacy` | `copy`
- `conversation.until`：可省略或 `null` 表示永久；必须带 `Z` 或 `+08:00` 等时区，过去时间会被拒绝
- `feedback.target`：`positive` | `negative` | `both`（仅 feedback 需要）
- `reason`：显示在黄色提示中

```json
{"feature":"feedback","enabled":true,"target":"negative"}
{"feature":"stop","enabled":true}
{"feature":"privacy","enabled":true}
{"feature":"copy","enabled":true}
```

## 数据与权限

- 用户授权开关保存在 DSH `configEditor`（profile 配置）；会话策略保存在 `storageDomain` 的 `conversation_lock` 域，重启后保留。
- 设置页 RPC 只接受 DSH 身份验证后的 owner Peer；未认证请求返回 401。
- 模型工具以执行上下文的 Agent ID 定位会话，不能指定其他 `SessionId`。
- 插件不新增 session event 类型，也不改写会话日志。

## 兼容范围与限制

- **这是本地限制，不是 DeepSeek 官方封禁或协议裁定。** 可关闭对应授权、卸载插件或随时解除。
- **停止与复制不是安全边界。** DSH 当前没有面向本机 owner 的拒绝策略接口，这两项使用限定在当前会话区域的 DOM 兼容层，页面卸载即恢复。不能阻止开发者工具、截图、系统级复制、其他客户端或直接 API 调用；宿主更新可能需要适配。
- **隐私限制不撤回已发送的数据。** Session Log 请求字段与会话 OTel 是两条独立通道，本插件分别控制。若你的 profile 补丁层把 `session-log-deepseek.enabled` 固定为 `false`，该开关本来就不会打开，插件只是保持并通过锁定表达状态。
- 已准备或正在发送的请求无法追溯撤回。

## 开发

```sh
npm test          # 13 项策略与后端集成测试
npm run check     # 四个运行文件的语法检查
npm pack --dry-run
```

测试覆盖关闭到期边界、时区校验、授权隔离、单独反馈限制、禁用评价拒绝写入、`/feedback` 共用策略、隐私排除与遥测/上传恢复、配置写入失败回滚、跨会话隔离。

## 许可

MIT。黄色对话锁图标为本项目原创。回答反馈按钮的 SVG 路径与按钮几何来自 DeepSeek Harness（MIT），详见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。
