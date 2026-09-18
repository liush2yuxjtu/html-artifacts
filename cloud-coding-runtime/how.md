# 复制这套 ChatGPT Chat 云端 Coding 工作环境

> 这是给团队成员复制并复现同一套工作方式的指南，不是给第二台机器做镜像。每个人使用自己的 Grokbot、Tailnet、本地 MCP、凭证和 Airtable，在 ChatGPT Chat 中获得一致的云端 Coding 能力并完成真实端到端验收。

交互式版本：

**https://liush2yuxjtu.github.io/html-artifacts/cloud-coding-runtime/how.html**

---

## 核心架构

```text
ChatGPT Chat
    ↓ MCP / Tools
Grokbot Cloud Coding Runtime
    ├─ Bash
    ├─ Git
    ├─ Persistent Workspace
    ├─ Anonymous Browser
    ├─ Authenticated Browser
    ├─ Isolated E2E Browser
    └─ Agent / Web App Testing
    ↓
Tailscale Tailnet
    ↓
Local Machine / Mac mini
    ├─ Local MCP
    ├─ Private Data
    ├─ Credentials
    └─ Local Services

Airtable = shared control plane
```

## 核心原则

**数据留在本地，计算去找数据。**

不要把整个 `.env`、Keychain、数据库 dump、用户目录或浏览器 profile 长期复制到云端。

云端只应通过受控接口取得当前任务所需的最小权限，例如：

```text
read_project_file(path)
query_database(readonly_sql)
get_test_fixture(id)
resolve_secret(name)
run_local_service_test(...)
```

## 六个能力

1. **云端执行**：Bash、Git、构建、测试、部署、持久工作区。
2. **私有网络**：Tailscale Tailnet 连接云端与本地设备。
3. **本地 MCP**：文件、数据库、本地 API、测试数据和内部服务。
4. **三类浏览器**：匿名、持久登录、隔离自动化 E2E。
5. **凭证代理**：按任务解析和使用凭证，不永久复制。
6. **跨设备状态**：Airtable 保存 Projects、Handoffs、Shared Context、Runs 和证据索引。

## Tailnet / Serve / Funnel

默认优先使用 **Tailnet / Tailscale Serve** 做私有访问。

只有外部互联网必须主动访问你的本地服务，例如 webhook / callback 时，才考虑 **Tailscale Funnel**。

注意：Funnel 是公网入口，不应被当成“私有 Tailnet 访问”的同义词。

官方资料：

- Tailscale Serve: https://tailscale.com/docs/features/tailscale-serve
- Tailscale Funnel: https://tailscale.com/docs/features/tailscale-funnel
- Tailscale Access Control: https://tailscale.com/docs/features/access-control

## 三类浏览器

### 1. Anonymous Browser

- 无登录态
- 干净 profile
- 公共网页
- 爬取
- 视觉检查

### 2. Authenticated Browser

- 持久 profile
- 保存 GitHub / Vercel / Airtable 等授权 session
- 需要时由 Human takeover 完成密码、2FA 或 CAPTCHA

### 3. Isolated E2E Browser

- 每次任务创建干净 context
- 用于 Playwright / webapp testing
- 注册、写入、破坏性测试
- 不污染日常登录浏览器

## Runtime Contract

```yaml
runtime:
  shell:
    bash: true

  workspace:
    persistent: true
    git: true

  network:
    tailnet: true

  browsers:
    anonymous: ephemeral
    authenticated: persistent
    testing: isolated

  local_resources:
    filesystem: mcp
    database: mcp
    services: mcp

  secrets:
    source: local
    exposure: per-task
    cloud_persistence: forbidden

  state:
    control_plane: airtable
```

## 端到端验收

不要把“配置存在”“进程启动”“build green”“deployment READY”当成完成。每一项都必须有**实际操作 + 明确通过条件 + 可复查证据**。

### 1. ChatGPT → 云端 Bash

- **操作**：从 ChatGPT 发起一次命令，至少执行 `pwd`、`uname -a`、`git --version`，再执行一个会失败的命令。
- **通过条件**：ChatGPT 能拿到真实 stdout、stderr 和 exit code；失败命令不能被伪装成成功。
- **证据**：保存命令、stdout/stderr、exit code、执行时间和运行环境标识。

### 2. Git + 持久工作区

- **操作**：clone 一个测试 repo，创建文件，commit；结束当前会话后重新进入同一个 runtime。
- **通过条件**：repo、未删除的工作文件和 commit 仍存在；`git status` 与 `git log -1` 可验证。
- **证据**：repo URL、commit SHA、重新进入 runtime 后的 `pwd` / `git status` / `git log -1`。

### 3. 匿名浏览器

- **操作**：打开一个公开网页，读取标题/正文，并保存截图。
- **通过条件**：浏览器没有依赖个人登录态；新任务可从干净状态重新访问。
- **证据**：访问 URL、页面标题、截图或 DOM/文本提取结果。

### 4. 持久登录浏览器

- **操作**：登录一个测试用 SaaS 账号，完成一次需要登录才能进行的只读操作；结束任务后再次打开。
- **通过条件**：授权 session 在预期范围内保持，不需要再次输入密码；不会与匿名/E2E browser 共用同一个 profile。
- **证据**：登录后页面、第二次打开仍处于登录态的截图/页面状态；禁止记录密码、Cookie 明文或 token。

### 5. 隔离 E2E 浏览器

- **操作**：连续运行两次同一个 E2E 测试；第一次写入一个临时状态，第二次从全新 context 启动。
- **通过条件**：第二次运行不继承第一次的 cookie、localStorage、sessionStorage 或临时登录状态；测试结果可重复。
- **证据**：两次 run ID、测试报告、关键断言、失败截图/视频（如有）。

### 6. Grokbot → Tailnet → 本地 MCP

- **操作**：从云端 runtime 通过 Tailnet 调用一个仅本地可访问的 MCP 工具，例如读取一个测试文件或查询只读测试数据。
- **通过条件**：关闭 Tailnet 路径后调用失败；恢复后成功，证明不是走公网旁路。
- **证据**：目标 Tailnet hostname/IP、MCP tool 名称、成功结果摘要，以及断开 Tailnet 时的失败证据。

### 7. 本地私密数据不复制上云

- **操作**：用本地 MCP 读取一个带唯一 marker 的测试数据，并完成一次云端计算/测试。
- **通过条件**：云端只拿到任务所需结果或最小数据片段；runtime workspace、repo、artifact 中不存在完整源数据副本。
- **证据**：marker 对应的调用结果、云端文件扫描结果、数据流说明；不得上传真实敏感样本作为证据。

### 8. Secret 按任务解析

- **操作**：通过 secret resolver 使用一个测试 secret 完成真实 API 调用。
- **通过条件**：调用成功；secret 不出现在 ChatGPT 文本、shell history、Git diff、日志、artifact、截图或 Airtable 中；任务结束后云端没有长期明文副本。
- **证据**：API 成功响应摘要、secret 名称/指纹（不是值）、对 repo/log/artifact 的泄漏扫描结果。

### 9. Airtable Handoff / Shared Context

- **操作**：设备 A 创建一条 handoff，设备 B/另一位团队成员读取并继续执行，然后把结果和状态写回。
- **通过条件**：接收方不依赖原聊天历史也能继续；状态、负责人、时间和结果可追踪。
- **证据**：Airtable record ID/链接、创建时间、接收时间、完成状态和结果摘要。

### 10. 真实项目完整闭环

- **操作**：选一个低风险真实任务，从 ChatGPT 完成：代码修改 → Git commit → 本地真实/生产类数据读取 → 自动化 E2E → 生成证据 → 部署/预览 → 浏览器验证。
- **通过条件**：所有阶段使用真实 runtime，不允许用 mock 结果冒充；最终页面或服务行为符合 acceptance criteria；失败时能定位到具体阶段。
- **证据**：commit SHA、测试 run/report、MCP 调用摘要、deployment URL/ID、最终浏览器验证截图或断言、完整时间线。

### 总体验收门槛

只有同时满足以下条件，才能标记为 **READY**：

- [ ] 上述 10 项全部通过。
- [ ] 每项都有可复查 evidence，不接受“我已经配置好了”。
- [ ] 没有发现 secret 泄漏到 repo / log / artifact / Airtable / ChatGPT 输出。
- [ ] 私密数据没有被整库/整目录复制到云端。
- [ ] 匿名、持久登录、E2E 三类浏览器 profile 已隔离。
- [ ] Tailnet 断开测试证明本地 MCP 不存在意外公网旁路。
- [ ] 至少完成 1 次真实项目完整闭环。
- [ ] 最终输出一张表：能力 / 状态 / evidence / 风险 / 下一步；任何缺少证据的能力都必须标成 **UNVERIFIED**，不能写 **READY**。


## 启动提示词

```text
按照下面两个链接，在你的账号上复制并复现这套完整的 ChatGPT Chat 云端 Coding 工作环境；用你自己的 Grokbot、Tailnet、本地 MCP、凭证和 Airtable，完成真实端到端验收。

1. 交互式指南：
https://liush2yuxjtu.github.io/html-artifacts/cloud-coding-runtime/how.html

2. Markdown 配置说明：
https://github.com/liush2yuxjtu/html-artifacts/blob/main/cloud-coding-runtime/how.md

目标不是简单安装工具，而是完成并验证一个可实际使用的 Personal Cloud Coding Fabric：

ChatGPT Chat
→ Grokbot 云端 Coding Runtime
→ Bash / Git / Persistent Workspace / 三类 Browser / Web App Testing
→ Tailscale Tailnet
→ 本地 MCP / 私密数据 / 凭证 / 本地服务
→ Airtable 跨设备 Control Plane。

执行要求：
- 优先读取现有配置和真实运行状态，不要从零重建已经存在的基础设施。
- 私密数据默认留在本地；云端通过受控 MCP / Tailnet 调用，不要把完整 .env、Keychain、数据库 dump 或浏览器 profile 复制到云端。
- 默认使用 Tailnet/Serve 做私有访问；只有公网回调确实需要时才使用 Funnel。
- 把浏览器明确分成：匿名浏览器、持久登录浏览器、隔离自动化 E2E 浏览器。
- 凭证按任务解析使用，不进入 repo、日志、artifact 或长期云端文件。
- Airtable 只作为跨设备控制平面和状态索引，不作为原始私密数据存储。
- 最终从 ChatGPT Chat 侧暴露稳定能力：bash、git、browser、webapp_test、local_data、secret、deploy。
- 每一步都要真实验收，不要用“配置存在”“build green”“服务启动”代替端到端 runtime evidence。
- 若已有 Grokbot / Tailnet / Mac mini / Airtable / MCP 基础设施，先复用和审计，再补缺口。
- 完成后给出：当前架构、已验证能力、未验证能力、风险、真实 runtime evidence，以及下一步最小补齐项。
```
