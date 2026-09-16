import path from 'node:path';

const ORIGIN = 'https://chatcut.io';
const MEDIA_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm|mov|m4v|mp3|wav|m4a|ogg|aac)(?:[?#].*)?$/i;
const FONT_EXT_RE = /\.(?:woff2?|ttf|otf|eot)(?:[?#].*)?$/i;
const CSS_EXT_RE = /\.css(?:[?#].*)?$/i;
const JS_EXT_RE = /\.(?:m?js)(?:[?#].*)?$/i;

function decodeHtmlEntities(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function cleanCandidate(value) {
  return decodeHtmlEntities(value)
    .replaceAll('\\/', '/')
    .replace(/[),;]+$/g, '')
    .trim();
}

function toAbsolute(candidate, pageUrl) {
  const cleaned = cleanCandidate(candidate);
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return null;
  try {
    return new URL(cleaned, pageUrl).toString();
  } catch {
    return null;
  }
}

export function discoverFeaturePaths(html) {
  const seen = new Set();
  const decoded = decodeHtmlEntities(html);
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of decoded.matchAll(hrefRe)) {
    const absolute = toAbsolute(match[1], ORIGIN + '/');
    if (!absolute) continue;
    const url = new URL(absolute);
    if (url.origin !== ORIGIN) continue;
    if (!/^\/features\/[^/?#]+\/?$/.test(url.pathname)) continue;
    seen.add(url.pathname.replace(/\/$/, ''));
  }
  return [...seen].sort();
}

export function extractAssetUrls(html, pageUrl) {
  const decoded = decodeHtmlEntities(html);
  const media = new Set();
  const stylesheets = new Set();
  const scripts = new Set();

  const consider = (raw) => {
    const absolute = toAbsolute(raw, pageUrl);
    if (!absolute) return;
    if (FONT_EXT_RE.test(absolute)) return;
    if (CSS_EXT_RE.test(absolute)) {
      stylesheets.add(absolute);
      return;
    }
    if (JS_EXT_RE.test(absolute)) {
      scripts.add(absolute);
      return;
    }
    if (MEDIA_EXT_RE.test(absolute)) media.add(absolute);
  };

  for (const match of decoded.matchAll(/(?:src|poster|href)\s*=\s*["']([^"']+)["']/gi)) {
    consider(match[1]);
  }

  for (const match of decoded.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of match[1].split(',')) {
      consider(part.trim().split(/\s+/)[0]);
    }
  }

  for (const match of decoded.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    consider(match[1]);
  }

  for (const match of decoded.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    consider(match[0]);
  }

  for (const match of decoded.matchAll(/(?:^|[\s"'(=:])((?:\/[A-Za-z0-9._~!$&()*+,;=:@%\/-]+)\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm|mov|m4v|mp3|wav|m4a|ogg|aac|css|m?js)(?:\?[^\s"'<>)]+)?)/gim)) {
    consider(match[1]);
  }

  return {
    media: [...media].sort(),
    stylesheets: [...stylesheets].sort(),
    scripts: [...scripts].sort(),
  };
}

export function assetOutputPath(assetUrl) {
  const url = new URL(assetUrl);
  if (FONT_EXT_RE.test(url.pathname)) throw new Error(`Font assets are excluded: ${assetUrl}`);
  const safeHost = url.hostname.replace(/[^A-Za-z0-9.-]/g, '_');
  const pathnameSource = url.pathname;
  let pathname;
  try {
    pathname = decodeURIComponent(pathnameSource);
  } catch {
    pathname = pathnameSource;
  }
  if (!pathname || pathname === '/') pathname = '/index-asset';
  pathname = pathname
    .split('/')
    .map((segment) => segment.replace(/[^A-Za-z0-9._~!$&'()+,;=@%-]/g, '_'))
    .join('/');
  return path.posix.join('_mirror', safeHost, pathname);
}

export function pageOutputPath(pathname) {
  const clean = pathname.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return clean ? path.posix.join(clean, 'index.html') : 'index.html';
}

function shouldRemoveScript(tag) {
  const lower = tag.toLowerCase();
  const trackingMarkers = [
    'googletagmanager.com',
    'google-analytics.com',
    'posthog',
    'ahrefs.com/analytics',
    'firstpromoter',
    'cloudflareinsights.com',
    'beacon.min.js',
    'gtm-',
    'auth/get-session',
  ];
  return trackingMarkers.some((marker) => lower.includes(marker));
}

export function sanitizeHtml(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (tag) =>
    shouldRemoveScript(tag) ? '' : tag,
  );
}

function rewriteAttrUrl(html, attr, replacer) {
  const re = new RegExp(`(${attr}\\s*=\\s*["'])([^"']+)(["'])`, 'gi');
  return html.replace(re, (_all, prefix, value, suffix) => `${prefix}${replacer(value, attr)}${suffix}`);
}

export function rewritePageLinks(html) {
  let out = html;
  const rewrite = (value, attr) => {
    const decoded = decodeHtmlEntities(value);
    if (/^(?:mailto:|tel:|javascript:|data:|blob:|#)/i.test(decoded)) return value;
    let url;
    try {
      url = new URL(decoded, ORIGIN + '/');
    } catch {
      return value;
    }

    if (url.origin !== ORIGIN) return value;

    if (attr.toLowerCase() === 'href') {
      if (url.pathname === '/' || url.pathname === '/features' || /^\/features\/[^/]+\/?$/.test(url.pathname)) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
      if (/\.(?:css|m?js)$/i.test(url.pathname)) return url.toString();
      return url.toString();
    }

    // src/poster and Astro island module attributes need a resolvable production URL before media localization.
    return url.toString();
  };

  for (const attr of ['href', 'src', 'poster', 'component-url', 'renderer-url', 'before-hydration-url']) {
    out = rewriteAttrUrl(out, attr, rewrite);
  }

  out = out.replace(/url\(\s*([\"']?)(\/(?!\/)[^\"')]+)\1\s*\)/gi, (_all, quote, value) => {
    const absolute = new URL(value, ORIGIN + '/').toString();
    return `url(${quote}${absolute}${quote})`;
  });

  out = out.replace(/srcset\s*=\s*["']([^"']+)["']/gi, (all, value) => {
    const quote = all.includes('="') ? '"' : "'";
    const rewritten = value
      .split(',')
      .map((part) => {
        const bits = part.trim().split(/\s+/);
        bits[0] = rewrite(bits[0], 'src');
        return bits.join(' ');
      })
      .join(', ');
    return `srcset=${quote}${rewritten}${quote}`;
  });

  return out;
}

export function rewriteMediaUrls(html, urlToLocalPath) {
  let out = html;
  const entries = [...urlToLocalPath.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [remote, local] of entries) {
    const variants = new Set([
      remote,
      remote.replaceAll('/', '\\/'),
      remote.replaceAll('&', '&amp;'),
    ]);
    for (const variant of variants) out = out.split(variant).join(local);
  }
  return out;
}

export function injectHomepagePatch(html, scriptText = '') {
  let out = html;
  if (!out.includes('/patches/home.css')) {
    out = out.replace(/<\/head\s*>/i, '<link rel="stylesheet" href="/patches/home.css"></head>');
  }
  if (scriptText) {
    if (!out.includes('data-cc-home-patch="inline"')) {
      const safeScript = scriptText.replace(/<\/script/gi, '<\\/script');
      out = out.replace(/<\/body\s*>/i, `<script data-cc-home-patch="inline">${safeScript}</script></body>`);
    }
  } else if (!out.includes('/patches/home.js')) {
    out = out.replace(/<\/body\s*>/i, '<script defer src="/patches/home.js"></script></body>');
  }
  return out;
}

export const mirrorInternals = {
  ORIGIN,
  MEDIA_EXT_RE,
  FONT_EXT_RE,
  CSS_EXT_RE,
  JS_EXT_RE,
  decodeHtmlEntities,
  toAbsolute,
};
