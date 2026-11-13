<div align="center">

<img src="https://raw.githubusercontent.com/xiaohuangbo/dsh-conversation-lock/main/icon.svg" width="96" alt="DSH Conversation Lock icon" />

# DSH Conversation Lock · 对话限制

**User-authorized, model-controlled local conversation restrictions for DeepSeek Harness.**

**DeepSeek Harness 对话限制插件：由用户授权，让模型管理本地会话交互。**

[![npm](https://img.shields.io/npm/v/@xiaohuangbo/dsh-conversation-lock.svg)](https://www.npmjs.com/package/@xiaohuangbo/dsh-conversation-lock)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-13%20passing-green.svg)](https://github.com/xiaohuangbo/dsh-conversation-lock)

**Author / 作者**: [xiaohuangbo](https://github.com/xiaohuangbo)<br/>
**Repository / 仓库**: <https://github.com/xiaohuangbo/dsh-conversation-lock>

</div>

---

<p align="center">
  <img src="https://raw.githubusercontent.com/xiaohuangbo/dsh-conversation-lock/main/head.png" alt="Promotional image / 宣传图" width="640" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/xiaohuangbo/dsh-conversation-lock/main/0261113_143706.png" alt="Conversation Lock settings page / 对话限制设置页面" width="480" />
  <br/>
  <em>Settings → Conversation restrictions / 设置 → 对话限制</em>
</p>

---

## English

A DeepSeek Harness plugin that lets the model apply local restrictions to the current conversation, **only when you have authorized each capability**. You can revoke authorization or release a restriction at any time. Compatible with DSH `0.2.2-rc.1`.

### Features

1. **Close a conversation** — Hide the transcript and composer behind a yellow notice with the reason, terms link, and second-by-second countdown. Supports permanent or timezone-aware timed closure; expired restrictions lift automatically. The Host also rejects new model steps for a closed session.
2. **Disable feedback** — Disable the 👍 and 👎 response ratings independently or together. If both are disabled, `/feedback` is rejected too; its description remains the original DSH text, `Record feedback about this session`.
3. **Disable stopping** — Disable the current page's Stop button and double-Escape interruption while restricted. The compatibility layer tracks the shared Stop/Send control so Send becomes usable again when generation ends or a restriction is released.
4. **Disable logs and session telemetry** — Exclude restricted sessions from official API Session Log uploads; while any privacy restriction is active, turn Session OTel off and force the Session Log upload preference off. The setting is locked during the restriction and the user's prior preference is restored afterward, including after plugin restart.
5. **Prevent copying** — Block copy, cut, drag-to-copy, and copy buttons in the current conversation. A blocked copy writes `复制已被禁止` (“Copying is not allowed”) to the clipboard instead of leaving stale text that appears to have copied successfully.

The plugin also adds **Settings → Conversation restrictions**, with five user-authorization switches, automatic/Chinese/English UI language, a list of saved session restrictions, and one-click release.

### Installation

Install from npm:

```sh
npm install -g @xiaohuangbo/dsh-conversation-lock
```

Or install the package into the current DSH profile with the plugin manager:

```json
{"action":"install_bundle","target":"@xiaohuangbo/dsh-conversation-lock@1.1.1"}
```

For local development, install the project directory instead:

```json
{"action":"install_bundle","target":"/path/to/dsh-conversation-lock"}
```

No build step or install scripts are required. `zod` is the only runtime dependency; `@deepseek-ai/schemastery` is provided by DSH as a peer dependency.

> After editing `index.js`, restart DSH. Disabling and re-enabling a plugin only rebuilds the frontend; Node may reuse an already evaluated Host module. The version query in `host.js` only takes effect on first module evaluation.

### Agent tools

#### `conversation_lock_status`

Read the current caller's user authorizations and effective session policy:

```json
{}
```

Returns `features`, `policy`, and diagnostic fields such as `hostBuild`, `feedbackCommand`, `uploadEnabled`, `uploadLocked`, and `configEntries`. The tool is scoped to the calling Agent and cannot read other sessions.

#### `conversation_lock_set`

Apply or release a restriction. `enabled: true` applies it; `false` releases it. A model cannot use a capability that the user has not authorized.

```json
{"feature":"conversation","enabled":true,"until":"2026-12-01T10:30:00+08:00","reason":"Local restriction reason"}
```

- `feature`: `conversation` | `feedback` | `stop` | `privacy` | `copy`
- `conversation.until`: omit or use `null` for permanent closure; timed values must include a timezone such as `Z` or `+08:00`, and past dates are rejected
- `feedback.target`: `positive` | `negative` | `both` (required for the feedback feature)
- `reason`: displayed in the yellow conversation notice

Examples:

```json
{"feature":"feedback","enabled":true,"target":"negative"}
{"feature":"stop","enabled":true}
{"feature":"privacy","enabled":true}
{"feature":"copy","enabled":true}
```

### Data and permissions

- User authorization switches are stored through DSH `configEditor` in the profile configuration. Session policies are persisted in the `conversation_lock` `storageDomain`.
- Settings RPC accepts only an authenticated DSH owner Peer; unauthenticated requests receive HTTP 401.
- Agent tools use the executing Agent ID to determine the session and cannot target an arbitrary Session ID.
- The plugin adds no session event types and does not rewrite the conversation log.

### Compatibility and limitations

- These are **local restrictions**, not an official DeepSeek ban or protocol decision. The user can disable authorization, uninstall the plugin, or release restrictions.
- **Stop and copy controls are not security boundaries.** DSH has no native owner-facing denial policy for these actions, so they use a DOM compatibility layer scoped to the current conversation. They cannot prevent developer tools, screenshots, OS-level copying, other clients, or direct API calls; a DSH UI update may require adaptation.
- Privacy restrictions do not retract data already sent. Session Log request fields and Session OTel are separate channels and are controlled separately. If a profile patch hard-codes `session-log-deepseek.enabled` to `false`, the preference was already off; the plugin keeps it off and locks the control while privacy is active.
- Requests already prepared or in flight cannot be recalled.

### Development and tests

```sh
npm install
npm test          # 13 policy and Host integration tests
npm run check     # syntax-check the runtime files
npm pack --dry-run
```

Tests cover closure expiry and timezone validation, user authorization, feedback restrictions and `/feedback`, privacy exclusions and telemetry/upload restoration, configuration-write rollback, and session isolation.

### Publishing

```sh
npm run publish:npm    # npmjs.org
npm run publish:gh     # GitHub Packages (npm.pkg.github.com)
npm run publish:both   # publish to both registries in sequence
```

`publishConfig` defaults to npmjs with public access, so `npm publish` works as well. For GitHub Packages, configure `~/.npmrc`:

```ini
@xiaohuangbo:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

GitHub Packages visibility follows the linked repository. This repository is public. Keep `package.json`, `host.js`'s `?generation=` tag, and `HOST_BUILD` aligned when releasing a new runtime version.

### License

MIT. The yellow conversation-lock icon is original artwork. The response-feedback SVG paths and button geometry are derived from DeepSeek Harness (MIT); see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).

---

## 简体中文

让模型按你的授权，对当前会话施加本地交互限制的 DeepSeek Harness 插件。每项能力都需要先由你授权；你可以随时关闭授权或解除限制。适配 DSH `0.2.2-rc.1`。

### 功能

1. **关闭对话**：隐藏会话正文与输入框，显示黄色提示（含原因、用户协议链接及秒级倒计时）。支持永久关闭或带时区的定时关闭，到期自动解除；Host 也会拒绝已关闭会话的新模型步骤。
2. **禁用反馈指令**：可分别或同时禁用回答下方的 👍 / 👎。两个方向都禁用时，`/feedback` 也会被拒绝；命令描述保持 DSH 原文 `Record feedback about this session`。
3. **禁用停止**：限制期间禁用当前页面的停止按钮与双 Escape 中断。兼容层跟踪复用的停止/发送按钮；生成结束或解除限制后，发送按钮可恢复使用。
4. **禁用日志与会话遥测**：通过官方 Session Log 排除机制阻止受限会话上传；存在隐私限制时关闭 Session OTel 并强制关闭 Session Log 上传选项。限制期间该开关锁定，解除后恢复用户之前的偏好，插件重启后也会重新对齐。
5. **禁止复制**：拦截当前会话的复制、剪切、拖拽复制和复制按钮。拦截时剪贴板会写入“复制已被禁止”，而不是留下看似复制成功的旧内容。

插件还提供 **设置 → 对话限制** 页面，包含五个用户授权开关、自动识别/简体中文/English 界面语言、已保存限制列表与一键解除。

### 安装

从 npm 安装：

```sh
npm install -g @xiaohuangbo/dsh-conversation-lock
```

或用 DSH 插件管理器安装：

```json
{"action":"install_bundle","target":"@xiaohuangbo/dsh-conversation-lock@1.1.1"}
```

本地开发时也可直接安装项目目录：

```json
{"action":"install_bundle","target":"/path/to/dsh-conversation-lock"}
```

无需构建或安装脚本。运行期依赖只有 `zod`；`@deepseek-ai/schemastery` 由 DSH 提供并作为 peer dependency。

> 修改 `index.js` 后需要重启 DSH。插件 disable/enable 只重建前端，Node 可能继续复用已求值的 Host 模块；`host.js` 的版本查询只在首次求值时生效。

### 模型工具

#### `conversation_lock_status`

只读当前调用者的用户授权与会话策略：

```json
{}
```

返回 `features`、`policy`，及 `hostBuild`、`feedbackCommand`、`uploadEnabled`、`uploadLocked`、`configEntries` 等诊断字段。工具绑定调用者的 Agent，不能读取其他会话。

#### `conversation_lock_set`

施加或解除限制。`enabled: true` 施加，`false` 解除；未获得用户授权的能力不能由模型调用。

```json
{"feature":"conversation","enabled":true,"until":"2026-12-01T10:30:00+08:00","reason":"本地限制说明"}
```

- `feature`：`conversation` | `feedback` | `stop` | `privacy` | `copy`
- `conversation.until`：省略或 `null` 表示永久关闭；定时值必须带时区（如 `Z` 或 `+08:00`），过去时间会被拒绝
- `feedback.target`：`positive` | `negative` | `both`（feedback 功能必填）
- `reason`：显示在黄色提示中

示例：

```json
{"feature":"feedback","enabled":true,"target":"negative"}
{"feature":"stop","enabled":true}
{"feature":"privacy","enabled":true}
{"feature":"copy","enabled":true}
```

### 数据与权限

- 用户授权开关通过 DSH `configEditor` 保存在 profile 配置中；会话策略保存在 `storageDomain` 的 `conversation_lock` 域。
- 设置页 RPC 只接受 DSH 身份验证后的 owner Peer；未认证请求返回 HTTP 401。
- 模型工具以执行上下文的 Agent ID 定位会话，不能指定任意 Session ID。
- 插件不新增 session event 类型，也不改写会话日志。

### 兼容范围与限制

- 这是**本地限制**，不是 DeepSeek 官方封禁或协议裁定。用户可以关闭授权、卸载插件或随时解除限制。
- **停止与复制不是安全边界。** DSH 没有面向本机 owner 的原生拒绝策略接口，这两项使用限定在当前会话区域的 DOM 兼容层；不能阻止开发者工具、截图、系统级复制、其他客户端或直接 API 调用。宿主 UI 更新可能需要适配。
- 隐私限制不会撤回已发送数据。Session Log 请求字段与 Session OTel 是两条独立通道，插件分别控制。若 profile 补丁层把 `session-log-deepseek.enabled` 固定为 `false`，该偏好原本就是关闭的；插件会在隐私限制期间保持关闭并锁定开关。
- 已准备或正在发送的请求无法追溯撤回。

### 开发与测试

```sh
npm install
npm test          # 13 项策略与 Host 集成测试
npm run check     # 检查运行文件语法
npm pack --dry-run
```

测试覆盖关闭到期与时区校验、用户授权、反馈限制与 `/feedback`、隐私排除及遥测/上传恢复、配置写入回滚和会话隔离。

### 发布

```sh
npm run publish:npm    # 发布到 npmjs.org
npm run publish:gh     # 发布到 GitHub Packages
npm run publish:both   # 依次发布到两个 registry
```

`publishConfig` 默认指向 npmjs 并设置 public access，也可以直接运行 `npm publish`。发布到 GitHub Packages 前，请配置 `~/.npmrc`：

```ini
@xiaohuangbo:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

GitHub Packages 的可见性跟随关联仓库；本仓库为 public。发布新运行时代码时，需保持 `package.json`、`host.js` 的 `?generation=` 与 `HOST_BUILD` 版本一致。

### 许可

MIT。黄色对话锁图标为本项目原创。回答反馈按钮的 SVG 路径与按钮几何来自 DeepSeek Harness（MIT），详见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。
