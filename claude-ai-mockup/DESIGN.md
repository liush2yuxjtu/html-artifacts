# Claude-inspired Demo 设计系统

版本：`triage-20260915-r2`。本文件约束 `claude-ai-mockup/`，不是 Anthropic 官方设计系统。页面是独立的本地交互研究，不接入模型 API，不提供登录或收费功能。

## 1. 目标与第一眼

保留暖纸张、陶土色标记、衬线标题、低噪声界面。主故事固定为：**一个想法 → 一项任务 → 可检查的成果**。首页只允许一个深色主任务：`Create a product artifact`。其他场景用轻量文字按钮，不再做三个平级卡片。

页面左上角使用 `Claude-inspired` 和 `Interaction study`，而非冒充官方产品的单独 Claude 品牌。顶部保留可读的 `Unofficial demo`，不加彩色底板或胶囊边框。输入框下面明确说明本地模板和数据边界。降低装饰权重不等于降低文字可读性。

## 2. 颜色及语义

数值真源是 `styles/tokens.css`。组件不得加入十六进制、RGB、HSL 的硬编码颜色。例外仅为 HTML 的 `theme-color` 元数据，它必须与 `--canvas` 相同，以及 forced-colors 使用的浏览器系统颜色。

| 用途 | Token | 值 |
|---|---|---|
| 纸张画布 | `--canvas` | `#f5f4ed` |
| 阅读底板 | `--surface` | `#faf9f5` |
| 文档与输入框 | `--surface-raised` | `#fffefa` |
| 侧边栏 | `--surface-muted` | `#efede5` |
| 用户气泡、禁用控件 | `--surface-strong` | `#e8e5dc` |
| 正文 | `--ink` | `#1f1d1a` |
| 次级正文 | `--ink-secondary` | `#4d4943` |
| 说明与占位符 | `--ink-muted` | `#676159` |
| 次要元数据 | `--ink-faint` | `#6b655d` |
| 装饰陶土色 | `--accent` | `#c96442` |
| 小字号陶土文字 | `--accent-ink` | `#9c452a` |
| 成功文字 | `--success` | `#456149` |
| 控件边框 | `--border-control` | `#817a70` |
| 键盘焦点 | `--focus` | `#2564a4` |

普通文字、占位符与实际背景的对比度至少 4.5:1；大字号至少 3:1。陶土装饰色不能直接用于小字号文本。不要通过半透明降低说明文字对比度。验证必须读取浏览器计算样式，而不是只检查 token 对。

## 3. 字体、间距、层级

不下载或分发字体。标题使用本机 Georgia / Times New Roman；界面使用系统无衬线；序号、快捷键使用系统等宽。正文 14–16px，元数据与控件文字不低于 12px；手机 textarea 为 16px。主标题 32–48px，文档标题 26–34px。

间距取 `--space-1` 到 `--space-10`：4、8、12、16、20、24、32、40、56、72px。组件尺寸、文字尺度、圆角、阴影、动画时间均优先引用 token。圆角为 8/12/18/24px；胶囊仅用于小状态标签。边框以 1px 为结构常量。

## 4. 组件契约

| 组件 | 变体与状态 | 行为与无障碍 |
|---|---|---|
| Button | primary / secondary / quiet / send；hover / active / disabled / working | 至少44×44px；真实 button；不可用时 disabled；焦点使用完整3px蓝色描边 |
| Icon | 单一 SVG symbol 字典 | 图形路径只定义一次；`use`复用；装饰图标 aria-hidden；图标按钮必须有名称 |
| Search | 默认、有结果、无结果、清空 | 原生 search input，过滤示例与当前标签页的会话；支持大小写不敏感、结果数播报、清空后归还焦点 |
| Navigation | Chats、Current artifact | 不展示未实现的 Projects / Research / Tools / Options；无成果时入口禁用并说明原因 |
| History | 示例、本次会话、当前选中 | 示例明确标记本地模板；会话可恢复，不冒充云端历史；刷新会清空本次会话 |
| Composer | 空、可提交、工作中、错误、附加笔记 | 空白禁止发送；Enter提交，Shift+Enter换行，IME确认不得发送；工作中Send变Stop |
| Add notes | 可读取、拒绝、截断、失败 | 真实读取本地.txt/.md，最大1MiB；输入上限16,000字符；显示文件名及未上传说明；不执行内容 |
| Activity | working / ready / stopped | 重要状态常驻DOM并通过status播报，不能只显示短暂toast |
| Result | 验证计划、产品简报、风险评审 | 不同场景有不同正文和步骤；不是只换标题。完成自动打开文档；可以重新打开与下载.md |
| Artifact | 桌面侧栏、窄屏模态 | 关闭按钮可键盘到达；Escape关闭；模态限制焦点且背景inert；关闭归还原入口或有效替代位置 |

## 5. 布局与响应式

桌面侧边栏272px，对话最大720px，输入框最大760px。成果面板使用420–580px。1179px及以下改成果模态，避免中等屏幕三列挤压；860px及以下侧边栏改抽屉，成果变全宽。

主结构使用100dvh与三个独立滚动/固定区域：顶栏、可滚动阅读区、底部输入区。输入框不是盖在内容上的绝对定位层。移动菜单关闭后既不可见，也不能被键盘聚焦。切换断点必须清理过期模态状态，不允许残留背景inert。

必须检查320、375、390、768、860、861、1024、1179、1180、1440px。额外检查375×460的小高度、长输入、打开/关闭两种状态。`scrollWidth <= innerWidth`是必要条件，不足以替代视觉检查和真实点击。

## 6. 深度与动态

阴影仅用于输入框、文档阅读纸张等有限层级。避免玻璃拟态、霓虹、过强悬浮卡片。状态进度是真实本地状态切换，不冒充远程模型思考。生成约0.9秒；减少动态效果模式缩短为约80ms并禁用动画。

取消和新对话必须清除计时器并递增序列号；任何迟到回调都不能重新打开旧成果。

## 7. 安全与真实性

所有用户、文件、场景文本通过textContent或文本节点写入，禁止innerHTML。模型名称只是显示选项，不包含未经验证的模型版本。没有真实登录、付费、部署成功、搜索互联网的假象。

原生HTML/CSS/JS零运行时依赖；所有资产本地；SVG标记原创，不复制官方商标图。文件输入仅在浏览器内存处理，最多保留本标签页最近25个完成的例子，不写入localStorage。

## 8. 验证与迁移

入口仍为`index.html`，链接不变；样式与脚本仍独立，统一使用`?v=triage-20260915-r2`缓存键。SVG字典属于静态文档结构，不是分散重复资产。

可执行验收为`tests/verify.py`。`--url`用于真实托管地址；默认使用回环HTTP。受限沙箱可用`--memory`运行真实Chromium中的源码交互，但必须明确这不是HTTP、GitHub Pages或实体手机验收。

自动检查覆盖交互、计算对比度、可访问名称、44px触控区、焦点、模态、断点、注入防护。它不是完整WCAG认证，也不等于实体屏幕阅读器或手机软键盘测试。部署后必须独立打开真实URL复核。URL查询参数不是不可变部署证明，源码版本以Git commit和文件哈希为准。

## 9. 参考来源

- 参考目录： https://github.com/VoltAgent/awesome-claude-design
- 选用方向： https://getdesign.md/claude/design-md ，公开的独立设计分析，描述暖陶土色与编辑式布局，不是官方规范。
- 系统管理： https://github.com/anthropics/knowledge-work-plugins/blob/main/design/skills/design-system/SKILL.md
- 评审流程： https://github.com/anthropics/knowledge-work-plugins/blob/main/design/skills/design-critique/SKILL.md
- 产品演示唯一真源： https://github.com/liush2yuxjtu/dot-pi/tree/main/agent/skills/product-demo
- 对比度标准： https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- 模态键盘规范： https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

后续修改：先读本文件和canonical skill，复用现有组件与token；更新行为与可验证证据，不用主观分数代替验收。
