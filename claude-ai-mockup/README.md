# Claude-inspired Demo：设计分诊修复

独立的本地产品演示。原路径保持不变：
https://liush2yuxjtu.github.io/html-artifacts/claude-ai-mockup/

## 本轮修改

原生搜索可过滤示例和当前标签页的会话，支持空结果及清空。首页收为一个主任务，成果完成后自动打开。删除只弹通知的未实现入口。产品简报、风险评审、验证计划各有独立内容。增加真实的本地文本文件读取和Markdown下载。

统一SVG symbol、按钮状态、44px触控尺寸与焦点。暗化说明文字和placeholder，小字号陶土色改为专用`--accent-ink`。淡化声明的底板和装饰，不淡化可读性。菜单和成果模态具有Escape、Tab环、背景inert和焦点返回；断点切换会清理旧状态。

演示不调用Anthropic API，模型仅为模拟选项。输入留在当前标签页内存；刷新会丢失本次会话。不要将它当成真正的AI回答。

## 文件

```text
claude-ai-mockup/
  DESIGN.md                  设计与交互真源
  index.html                 语义结构及统一SVG字典
  app.js                     本地场景、状态与焦点管理
  styles/tokens.css          颜色、字体、尺寸、间距
  styles/components.css      组件与响应式
  tests/verify.py             可执行浏览器验收
  verify.sh                  验收入口
  verification-summary.json  带源码SHA-256的本地验收摘要
```

## 运行及复验

这是零构建静态页面，直接打开`index.html`或用任意静态服务器。开发验收依赖Python、Playwright及Chrome/Chromium；生产页面没有这些依赖。

```sh
python3 -m pip install playwright==1.57.0
python3 -m playwright install chromium
bash verify.sh
# macOS使用已有Chrome：
bash verify.sh --browser '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
# 独立验证真实部署，不要拿本地PASS代替：
bash verify.sh --url 'https://liush2yuxjtu.github.io/html-artifacts/claude-ai-mockup/'
```

若浏览器策略禁止HTTP和file导航，可以用`bash verify.sh --memory`在真实浏览器中加载本地源码验收交互。这不是路由验收，也不是不可变托管预览。

测试输出`evidence/verification.json`、桌面/移动截图和实际下载文件。摘要记录验证边界；232项本地检查通过不意味着完整WCAG认证或实体手机检查。发布之后仍需独立浏览器检查真实URL与release标记。

## 约束

只修改此目录，不改其他artifact、GitHub Pages设置或CI门禁。不合入新的CDN、字体、分析脚本或密钥。下一轮改动从`DESIGN.md`开始。
