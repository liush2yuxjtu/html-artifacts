# 在 ChatGPT Chat 中启用完整云端 Coding

> 目标：让 ChatGPT Chat 获得一个真正可用的云端 Coding Runtime，同时安全访问本地私密数据、凭证和真实服务，并能够完成端到端测试。

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

不要把“配置存在”“进程启动”“build green”“deployment READY”当成完成。

必须验证：

- [ ] ChatGPT 能调用云端 Bash 并返回真实 stdout/stderr。
- [ ] Git clone / edit / commit 在持久 workspace 可用。
- [ ] 匿名浏览器可访问公开网页。
- [ ] 持久登录浏览器能保留授权 session。
- [ ] 自动化 E2E 浏览器每次使用隔离 context。
- [ ] 云端能通过 Tailnet 调用本地 MCP。
- [ ] 本地真实数据无需完整复制到云端即可用于测试。
- [ ] 凭证可按任务解析使用，且不会进入 repo / log / artifact。
- [ ] Airtable 可完成跨设备 handoff / shared context。
- [ ] 一个真实项目可完成代码修改 → 本地真实数据 → E2E → 证据 → 部署。

## 启动提示词

```text
按照下面两个链接，在你的账号上启用完整的 ChatGPT Chat 云端 Coding 能力。

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
