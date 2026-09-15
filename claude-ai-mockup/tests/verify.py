#!/usr/bin/env python3
"""真实浏览器验收。默认在隔离回环服务器验证；--url 验证真实托管网址。
依赖: Python 3.10+、playwright、Chrome 或 Chromium。不把静态源码检查当运行验收。
"""
from __future__ import annotations
import argparse, hashlib, json, re, shutil, sys, threading
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--memory', action='store_true', help='仅在禁止导航的沙箱中：用真实 Chromium 渲染本地源码，不冒充 HTTP 验证')
parser.add_argument('--url', help='真实部署 URL；省略时用本地真实浏览器验收')
parser.add_argument('--browser', default=shutil.which('chromium') or shutil.which('google-chrome'), help='Chrome/Chromium 可执行文件')
parser.add_argument('--output', type=Path, default=ROOT / 'evidence')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
results, exceptions, network = [], [], []

def check(name, condition, detail=None):
    passed = bool(condition)
    print(('PASS ' if passed else 'FAIL ') + name, flush=True)
    results.append({'check': name, 'result': 'PASS' if passed else 'FAIL', 'detail': detail})
    if not passed:
        raise AssertionError(f'{name}: {detail}')

@contextmanager
def site():
    if args.memory:
        yield 'browser-memory://local-source/'
        return
    if args.url:
        yield args.url
        return
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *unused): pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT.parent)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}/{ROOT.name}/'
    finally:
        server.shutdown(); server.server_close(); thread.join()

def navigate(page, url):
    if not args.memory:
        return page.goto(url, wait_until='networkidle')
    markup = (ROOT / 'index.html').read_text()
    markup = re.sub(r'<link[^>]+rel="stylesheet"[^>]*>', '', markup)
    markup = re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>', '', markup)
    # 在真实浏览器加载实际源码；不模拟任何应用事件、状态或接口响应。
    page.set_content(markup, wait_until='domcontentloaded')
    page.add_style_tag(path=str(ROOT / 'styles/tokens.css'))
    page.add_style_tag(path=str(ROOT / 'styles/components.css'))
    page.add_script_tag(path=str(ROOT / 'app.js'))
    page.wait_for_timeout(250)  # 等待注入样式时产生的初始 CSS 过渡结束。
    return None

AUDIT = r'''() => {
 const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert],[hidden]');
 // Playwright 截图会留下 style=""；空属性不包含任何内联样式声明。
 const all = [...document.querySelectorAll('button, input:not([type="file"]), select, summary')].filter(visible);
 const targets = all.map(el => ({id:el.id || el.textContent.trim().slice(0,45), w:el.getBoundingClientRect().width, h:el.getBoundingClientRect().height}));
 const unlabeled = all.filter(el => el.tagName !== 'SUMMARY' && !el.textContent.trim() && !el.getAttribute('aria-label') && !el.labels?.length).map(el=>el.id);
 return {width:innerWidth, scrollWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth,
   undersized:targets.filter(r=>r.w <43.99 || r.h<43.99), unlabeled, inlineStyles:[...document.querySelectorAll('[style]')].filter(el=>el.getAttribute('style').trim()).length,
   focus:document.activeElement?.id, minTextSize:Math.min(...[...document.querySelectorAll('p,button,label,input,select,span,summary')].filter(visible).filter(el=>el.textContent.trim()||el.tagName==='INPUT').map(el=>parseFloat(getComputedStyle(el).fontSize)))};
}'''
CONTRAST = r'''() => {
 const parse = c => (c.match(/[\d.]+/g)||[]).map(Number);
 const blend = (fg,bg) => {const a=fg[3]??1;return fg.slice(0,3).map((c,i)=>c*a+bg[i]*(1-a));};
 const lum = rgb => rgb.slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
 const ratio = (a,b)=>{let x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const background = el => {const path=[]; for(let e=el;e;e=e.parentElement)path.unshift(e);let bg=[255,255,255];for(const e of path){const c=parse(getComputedStyle(e).backgroundColor);if(c.length>=3)bg=blend(c,bg);}return bg;};
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const failures=[],samples=[];let node;
 while(node=walker.nextNode()){
   const el=node.parentElement;if(!node.textContent.trim()||!el||['SCRIPT','STYLE','OPTION','NOSCRIPT','SYMBOL'].includes(el.tagName)||el.closest('[hidden],[inert],.sr-only,.svg-library')||!el.getClientRects().length)continue;
   const st=getComputedStyle(el);if(st.visibility==='hidden'||st.opacity==='0')continue;
   const bg=background(el),fg=blend(parse(st.color),bg),size=parseFloat(st.fontSize),bold=parseInt(st.fontWeight)>=700;
   const minimum=(size>=24||(size>=18.66&&bold))?3:4.5;const value=ratio(fg,bg);
   const sample={text:node.textContent.trim().slice(0,70),ratio:Number(value.toFixed(3)),minimum,size};samples.push(sample);
   if(value+0.001<minimum)failures.push(sample);
 }
 for(const el of document.querySelectorAll('input[placeholder],textarea[placeholder]')){
   if(!el.getClientRects().length||el.closest('[inert],[hidden]'))continue;
   const bg=background(el),st=getComputedStyle(el,'::placeholder'),value=ratio(blend(parse(st.color),bg),bg);
   const sample={text:'placeholder:'+el.id,ratio:Number(value.toFixed(3)),minimum:4.5,size:parseFloat(getComputedStyle(el).fontSize)};samples.push(sample);if(value<4.5)failures.push(sample);
 }
 return {failures, minimumObserved:Math.min(...samples.map(s=>s.ratio)), samples};
}'''

def audit(page, name):
    page.wait_for_timeout(160)
    data = page.evaluate(AUDIT)
    check(name+' / 无横向溢出', data['scrollWidth'] <= data['width'] and data['bodyWidth'] <= data['width'], data)
    check(name+' / 44×44 控件', not data['undersized'], data['undersized'])
    check(name+' / 控件名称', not data['unlabeled'], data['unlabeled'])
    check(name+' / 无内联样式', data['inlineStyles'] == 0, data['inlineStyles'])
    check(name+' / 正文与元数据至少12px', data['minTextSize'] >= 12, data['minTextSize'])
    contrast = page.evaluate(CONTRAST)
    check(name+' / 实际文本对比度', not contrast['failures'], {'failures':contrast['failures'], 'minimumObserved':contrast['minimumObserved']})
    return data

try:
 with site() as url, sync_playwright() as p:
    kwargs = {'headless':True, 'args':['--no-sandbox']}
    if args.browser: kwargs['executable_path'] = args.browser
    browser = p.chromium.launch(**kwargs)
    context = browser.new_context(viewport={'width':1440,'height':1000}, accept_downloads=True)
    page = context.new_page(); page.set_default_timeout(8000)
    page.on('pageerror', lambda e: exceptions.append(str(e)))
    page.on('request', lambda r: network.append(r.url))
    response = navigate(page, url)
    check('本地源码渲染完成' if args.memory else '页面正常加载', page.title().startswith('Claude-inspired') if args.memory else response.status == 200, 'Chromium DOM, not HTTP' if args.memory else response.status)
    check('版本标记', page.locator('html').get_attribute('data-release') == 'triage-20260915-r2')
    expect(page.locator('#welcome')).to_be_visible()
    check('唯一主任务', page.locator('#welcome .button-primary').count() == 1)
    check('移除通知型假入口', page.locator('[data-nav]').count() == 0)
    check('空输入禁止发送', page.locator('#sendButton').is_disabled())
    check('未生成时 Artifact 入口禁用', page.locator('#artifactsNav').is_disabled())
    check('Search 为真实输入框', page.locator('#conversationSearch').get_attribute('type') == 'search')
    audit(page,'桌面欢迎页')
    page.screenshot(path=str(args.output/'desktop-welcome.png'), full_page=True)

    page.locator('#conversationSearch').fill('BRIEF')
    check('搜索大小写不敏感且过滤真实数据', page.locator('.history-item').count()==1)
    page.locator('#conversationSearch').fill('no-such-conversation-190293')
    check('搜索空状态', page.locator('.history-item').count()==0 and page.locator('#emptySearch').is_visible())
    page.locator('#clearSearch').click()
    check('清空搜索并恢复焦点', page.locator('.history-item').count()==3 and page.evaluate('document.activeElement.id')=='conversationSearch')

    page.locator('#primaryDemo').click()
    check('显示工作中状态', page.locator('#activity').get_attribute('data-busy')=='true')
    expect(page.locator('#artifactPanel')).to_be_visible()
    check('一步生成并自动打开 Artifact', page.locator('#thread').is_visible() and page.locator('#resultCard').is_visible())
    check('验证计划的四个真实内容块', page.locator('.artifact-step').count()==4)
    audit(page,'桌面成果页')
    page.screenshot(path=str(args.output/'desktop-artifact.png'), full_page=True)
    page.locator('#modelSelect').select_option('Opus')
    check('模型选项更新两个区域', 'Opus' in page.locator('#modelLabel').inner_text() and 'Opus' in page.locator('#artifactModel').inner_text())
    page.locator('#closeArtifact').click()
    page.locator('#openArtifactButton').click(); page.keyboard.press('Escape')
    check('成果关闭归还焦点', page.locator('#artifactPanel').is_hidden() and page.evaluate('document.activeElement.id')=='openArtifactButton')
    page.locator('#artifactsNav').click()
    with page.expect_download() as download_event: page.locator('#downloadArtifact').click()
    download=download_event.value; download.save_as(str(args.output/'downloaded-artifact.md'))
    content=(args.output/'downloaded-artifact.md').read_text()
    check('下载真实 Markdown 成果', 'From a promising idea' in content and 'Opus (simulated)' in content)
    page.locator('#newChatBtn').click()
    check('新对话复位并保留本次记录', page.locator('#welcome').is_visible() and page.locator('#artifactPanel').is_hidden() and page.locator('.history-item').count()==4)
    page.locator('[data-history-id="session-1"]').click()
    expect(page.locator('#artifactPanel')).to_be_visible()
    check('恢复本次会话而非假历史入口', page.locator('#artifactTitle').inner_text()=='Product validation plan')
    for key, title, count in [('brief','One-page product brief',4),('risks','Launch risk review',3)]:
      page.locator('#newChatBtn').click(); page.locator(f'[data-scenario="{key}"]').click()
      expect(page.locator('#artifactPanel')).to_be_visible()
      check(key+' 场景具有独立结果', page.locator('#artifactTitle').inner_text()==title and page.locator('.artifact-step').count()==count)

    page.locator('#newChatBtn').click(); page.locator('#primaryDemo').click(); page.locator('#sendButton').click()
    page.wait_for_timeout(1100)
    check('取消后无迟到结果', page.locator('#artifactPanel').is_hidden() and page.locator('#retryButton').is_visible() and 'Stopped' in page.locator('#statusText').inner_text())
    page.locator('#retryButton').click(); expect(page.locator('#artifactPanel')).to_be_visible()
    check('取消后可以重试', page.locator('#resultCard').is_visible())
    page.locator('#newChatBtn').click(); page.locator('#primaryDemo').click(); page.keyboard.press('Control+k'); page.wait_for_timeout(1100)
    check('生成中复位不泄漏旧结果', page.locator('#welcome').is_visible() and page.locator('#artifactPanel').is_hidden())
    page.locator('#composerInput').fill('中文输入测试')
    page.locator('#composerInput').dispatch_event('keydown',{'key':'Enter','isComposing':True,'bubbles':True})
    check('中文输入法确认不误发送', page.locator('#welcome').is_visible())
    page.locator('#composerInput').fill('line one'); page.locator('#composerInput').press('Shift+Enter')
    check('Shift+Enter 换行', '\n' in page.locator('#composerInput').input_value())
    injection='<img src=x onerror="window.__injected=1"><script>window.__injected=1</script>'
    page.locator('#composerInput').fill(injection); page.locator('#composerInput').press('Enter')
    expect(page.locator('#artifactPanel')).to_be_visible()
    check('输入按纯文本显示', page.locator('#userPrompt').inner_text()==injection and not page.evaluate('!!window.__injected') and page.locator('#userPrompt img,#userPrompt script').count()==0)
    page.locator('#newChatBtn').click()
    page.locator('#notesFile').set_input_files({'name':'notes.md','mimeType':'text/markdown','buffer':b'# Notes\nReview the launch risks.'})
    expect(page.locator('#attachmentStatus')).to_be_visible()
    check('添加文件真正填入文本', 'Review the launch' in page.locator('#composerInput').input_value() and not page.locator('#sendButton').is_disabled())
    page.locator('#notesFile').set_input_files({'name':'bad.html','mimeType':'text/html','buffer':b'<script>alert(1)</script>'})
    expect(page.locator('#inputError')).to_be_visible()
    check('拒绝不支持文件并显示错误', 'Choose a .txt or .md' in page.locator('#inputError').inner_text())
    page.locator('#notesFile').set_input_files({'name':'oversized.txt','mimeType':'text/plain','buffer':b'x'*(1024*1024+1)})
    check('拒绝超过1MB文件', page.locator('#inputError').is_visible())

    for width in [320,375,390,768,860,861,1024,1179,1180,1440]:
      page.set_viewport_size({'width':width,'height':900 if width>860 else 812})
      navigate(page, url)
      audit(page,f'{width}px 欢迎页')
      if width==375: page.screenshot(path=str(args.output/'mobile-welcome.png'), full_page=True)
      if width<=860:
        check(f'{width}px 关闭菜单不可获焦', page.locator('#sidebar').evaluate('(el)=>el.inert') and not page.locator('#closeNavigation').is_visible())
        page.locator('#mobileMenuButton').click()
        check(f'{width}px 菜单模态语义', page.locator('#sidebar').get_attribute('aria-modal')=='true' and page.locator('#chatPane').evaluate('(el)=>el.inert'))
        page.locator('#closeNavigation').focus(); page.keyboard.press('Shift+Tab')
        check(f'{width}px 菜单反向焦点环', page.evaluate('document.activeElement.closest("#sidebar")!==null'))
        page.keyboard.press('Tab')
        check(f'{width}px 菜单正向焦点环', page.evaluate('document.activeElement.id')=='closeNavigation')
        page.keyboard.press('Escape')
        check(f'{width}px 菜单关闭焦点返回', page.evaluate('document.activeElement.id')=='mobileMenuButton')
      page.locator('#primaryDemo').click(); expect(page.locator('#artifactPanel')).to_be_visible()
      audit(page,f'{width}px 成果页')
      if width==375: page.screenshot(path=str(args.output/'mobile-artifact.png'), full_page=True)
      if width<1180:
        check(f'{width}px Artifact 模态语义', page.locator('#artifactPanel').get_attribute('aria-modal')=='true' and page.locator('#chatPane').evaluate('(el)=>el.inert'))
        page.locator('#closeArtifact').focus(); page.keyboard.press('Shift+Tab')
        check(f'{width}px Artifact 反向焦点环', page.evaluate('document.activeElement.id')=='downloadArtifact')
        page.keyboard.press('Tab'); check(f'{width}px Artifact 正向焦点环', page.evaluate('document.activeElement.id')=='closeArtifact')
      page.keyboard.press('Escape')
      check(f'{width}px 退出无隐藏焦点', page.locator('#artifactPanel').is_hidden() and not page.evaluate('!!document.activeElement.closest("[hidden],[inert]")'))

    page.set_viewport_size({'width':375,'height':460}); navigate(page, url)
    page.locator('#composerInput').fill('A very long note ' * 800)
    audit(page,'375×460 键盘近似小视口')
    check('小视口发送按钮未被遮住', page.locator('#sendButton').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest("#sendButton")!==null;}'))
    page.set_viewport_size({'width':1440,'height':1000}); navigate(page, url)
    page.locator('#primaryDemo').focus()
    focus=page.locator('#primaryDemo').evaluate('(el)=>({style:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth})')
    check('键盘焦点可见', focus['style']!='none' and float(focus['width'].replace('px',''))>=2, focus)
    page.set_viewport_size({'width':375,'height':812}); page.locator('#mobileMenuButton').click(); page.set_viewport_size({'width':1440,'height':1000})
    page.wait_for_timeout(80)
    check('移动到桌面清理菜单与惯性状态', not page.locator('#sidebar').evaluate('(el)=>el.inert') and not page.locator('#chatPane').evaluate('(el)=>el.inert') and page.locator('#scrim').is_hidden())
    context2=browser.new_context(viewport={'width':375,'height':812}, reduced_motion='reduce'); reduced=context2.new_page(); navigate(reduced, url)
    reduced.locator('#primaryDemo').click(); expect(reduced.locator('#artifactPanel')).to_be_visible()
    check('减少动态效果模式仍能完成', reduced.locator('.status-dot').evaluate('(el)=>getComputedStyle(el).animationName')=='none')
    context2.close()
    if not args.url and not args.memory:
      offline=browser.new_context(offline=True,viewport={'width':1440,'height':1000}); op=offline.new_page();op.goto((ROOT/'index.html').as_uri())
      op.locator('#primaryDemo').click();expect(op.locator('#artifactPanel')).to_be_visible()
      check('file:// 完全离线可用', op.locator('#artifactSteps .artifact-step').count()==4);offline.close()
    allowed_origin=url.split('/')[2]
    unexpected=[u for u in network if u.startswith(('http://','https://')) and u.split('/')[2]!=allowed_origin]
    check('无第三方运行时请求', not unexpected, unexpected)
    check('无未处理浏览器异常', not exceptions, exceptions)
    browser_version=browser.version
    browser.close()
except Exception as exc:
    exceptions.append(str(exc))
    if not results or results[-1]['result']!='FAIL': results.append({'check':'测试执行','result':'FAIL','detail':str(exc)})
    browser_version=locals().get('browser_version','see exception')
finally:
    summary={'result':'PASS' if results and all(r['result']=='PASS' for r in results) and not exceptions else 'FAIL',
      'timestamp_utc':datetime.now(timezone.utc).isoformat(), 'render_mode':'in-memory real Chromium; navigation unavailable' if args.memory else 'navigated browser', 'url':locals().get('url'), 'browser':browser_version,
      'checks':results,'errors':exceptions,'accessibility_scope':'Computed text/placeholder contrast, control names, 44px targets, keyboard focus/traps, modal inert state. Not a complete WCAG or screen-reader audit; axe-core unavailable in this environment.',
      'runtime_sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in [ROOT/'index.html',ROOT/'app.js',ROOT/'styles/tokens.css',ROOT/'styles/components.css']}}
    (args.output/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'result':summary['result'],'passed':sum(r['result']=='PASS' for r in results),'failed':[r for r in results if r['result']=='FAIL'],'errors':exceptions},ensure_ascii=False,indent=2))
    sys.exit(0 if summary['result']=='PASS' else 1)
