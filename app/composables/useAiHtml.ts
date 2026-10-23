import DOMPurify from 'isomorphic-dompurify'

/**
 * AI 富文本输出的处理管线
 *
 * 模型返回的 HTML 直接进编辑器（TinyMCE），必须先净化：
 * 一旦模型被诱导输出 <script> / onerror 之类，等于把 XSS 写进正文。
 * 白名单只放开排版需要的标签，style / class / 事件属性一律不放。
 */

/** 允许的标签：够排版用（标题、列表、引用、代码、表格），不含 iframe / style / img */
const ALLOWED_TAGS = [
    'p',
    'br',
    'h2',
    'h3',
    'h4',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'a',
    'hr',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
]

const ALLOWED_ATTR = [
    'href',
    'title',
    'target',
    'rel',
    'colspan',
    'rowspan',
    'class',
]

/**
 * 代码块的语言类名：正文渲染管线靠 `class="language-xxx"` 选 Shiki 语法，
 * 丢掉这个 class 代码就只剩一片黑白（见 useArticleHtml 的 CODE_BLOCK_RE）。
 * 只放行 language-* 这一种写法，其它 class 一律剥掉。
 */
const LANG_CLASS_RE = /^language-[\w+#.-]+$/

/**
 * 只放行「文字颜色 / 字形」相关的内联样式。
 *
 * 为什么不整个放开 style：AI 产出的 style 可能带 position / background-image /
 * url() 之类，能做出覆盖层、加载外链资源。这里只保留配色与字形，且值必须匹配
 * 有限的形式（#hex、rgb()/hsl()、数字、关键字、var(--token)）。
 */
const ALLOWED_STYLE_PROPS = [
    'color',
    'background-color',
    'font-weight',
    'font-style',
    'text-decoration',
    'text-align',
]

const SAFE_STYLE_VALUE =
    /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|\d{1,3}|[a-zA-Z-]{3,20}|var\(--[\w-]+\))$/

/** 逐条过滤 style 声明，返回过滤后的 CSS 文本（可能为空） */
const filterStyle = (css: string) =>
    css
        .split(';')
        .map(decl => {
            const index = decl.indexOf(':')
            if (index < 0) return ''
            const prop = decl.slice(0, index).trim().toLowerCase()
            const value = decl.slice(index + 1).trim()
            if (!ALLOWED_STYLE_PROPS.includes(prop)) return ''
            if (!SAFE_STYLE_VALUE.test(value)) return ''
            return `${prop}: ${value}`
        })
        .filter(Boolean)
        .join('; ')

/**
 * 净化后的 HTML 里再收敛 style 属性。
 *
 * DOMPurify 不校验 CSS 值，所以先让它保留 style，再逐条过滤。
 * 这里走 DOM 而不是正则：代码块里出现的 `style="color:red"` 是文本节点，
 * 正则会被误伤（实测把示例代码改成了 `style="color: red"`），而 DOM 只处理属性。
 */
export const sanitizeAiHtml = (html: string) => {
    const fragment = DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR: [...ALLOWED_ATTR, 'style'],
        ADD_ATTR: ['target'],
        RETURN_DOM_FRAGMENT: true,
    }) as unknown as DocumentFragment

    fragment.querySelectorAll('[style]').forEach(el => {
        const kept = filterStyle(el.getAttribute('style') || '')
        if (kept) el.setAttribute('style', kept)
        else el.removeAttribute('style')
    })

    // class 只留 <pre>/<code> 上的 language-xxx，其余（含模型瞎编的工具类）全部剥掉
    fragment.querySelectorAll('[class]').forEach(el => {
        const tag = el.tagName.toLowerCase()
        const value = (el.getAttribute('class') || '').trim()
        if ((tag === 'pre' || tag === 'code') && LANG_CLASS_RE.test(value))
            return
        el.removeAttribute('class')
    })

    const wrapper = fragment.ownerDocument.createElement('div')
    wrapper.appendChild(fragment)
    return wrapper.innerHTML
}

export const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 纯文本 → 段落 HTML：空行分段，单换行转 <br> */
export const textToHtml = (text: string) =>
    text
        .split(/\n{2,}/)
        .filter(block => block.trim())
        .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
        .join('')

/** 去掉模型偶尔加的 ```html 围栏（整段被包住时） */
const OUTER_FENCE_RE =
    /^\s*```([a-zA-Z]*)[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```\s*$/

/**
 * 只拆「把整段 HTML 包起来」的那种围栏。
 * 整段就是一个代码块（```js … ```）时不能拆，拆完代码就变成普通段落了。
 */
const unwrapOuterFence = (raw: string) => {
    const m = raw.match(OUTER_FENCE_RE)
    if (!m) return raw
    // 两个捕获组理论上都在（正则要求成对），但 noUncheckedIndexedAccess 下
    // 下标访问的类型是 `string | undefined`，这里统一兜成空串
    const lang = (m[1] ?? '').toLowerCase()
    const inner = m[2] ?? ''
    if (['html', 'markup', 'vue'].includes(lang)) return inner
    // 没写语言时看内容：像 HTML 片段才当包装层，否则它就是一个代码块
    if (!lang && ANY_TAG_RE.test(inner)) return inner
    return raw
}

/** 常见别名 → Shiki 已加载的语言名（见 useShiki） */
const LANG_ALIASES: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    markup: 'html',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
}

const normalizeLang = (raw: string) => {
    const lang = raw.trim().toLowerCase()
    return LANG_ALIASES[lang] ?? lang
}

/** ```lang\ncode``` —— 语言名可空，允许没有换行（```code```） */
const FENCE_RE = /```([\w+#.-]*)[ \t]*\r?\n?([\s\S]*?)```/g

const codeBlockHtml = (lang: string, code: string) =>
    `<pre class="language-${normalizeLang(lang || 'text')}"><code>${escapeHtml(
        code.replace(/\r?\n$/, '')
    )}</code></pre>`

/** HTML 里夹着 Markdown 围栏：就地换成代码块 */
const fencesToHtml = (html: string) =>
    html.replace(FENCE_RE, (_, lang: string, code: string) =>
        codeBlockHtml(lang, code)
    )

/** 纯文本里夹着围栏：散文走段落，代码走 <pre> */
const textWithFencesToHtml = (text: string) => {
    const parts: string[] = []
    let last = 0
    for (const m of text.matchAll(FENCE_RE)) {
        const before = text.slice(last, m.index)
        if (before.trim()) parts.push(textToHtml(before))
        parts.push(codeBlockHtml(m[1] ?? '', m[2] ?? ''))
        last = (m.index ?? 0) + m[0].length
    }
    const tail = text.slice(last)
    if (tail.trim()) parts.push(textToHtml(tail))
    return parts.join('')
}

/** 出现这些块级标签，说明可以直接进编辑器 */
const BLOCK_TAG_RE =
    /<(p|h[1-6]|ul|ol|li|blockquote|pre|table|div|section|hr)\b/i

/** 任意 HTML 标签：只要带了标签就按 HTML 处理（哪怕只有 <span>） */
const ANY_TAG_RE = /<\/?[a-z][\w-]*(\s[^>]*)?>/i

/**
 * 归一化 AI 的富文本输出：
 * 1. 拆掉包裹整段 HTML 的 ``` 围栏
 * 2. 剩下的 ``` 围栏一律转成 <pre class="language-xxx"><code>——
 *    留着不管的话，文章正文里会直接显示 ```js 这种字面量
 * 3. 没有标签（模型回了纯文本）→ 按空行转段落
 * 4. 净化
 * 5. 只剩行内标签时包一层 <p>：TinyMCE 的 insertContent 拿到裸 <span> 会
 *    当成纯文本转义插入，正文里会直接出现 &lt;span&gt;
 */
export const normalizeAiHtml = (raw: string) => {
    const unwrapped = unwrapOuterFence(raw)
    if (!unwrapped.trim()) return ''

    const html = ANY_TAG_RE.test(unwrapped)
        ? fencesToHtml(unwrapped)
        : textWithFencesToHtml(unwrapped)
    const safe = sanitizeAiHtml(html).trim()
    if (!safe) return ''

    return BLOCK_TAG_RE.test(safe) ? safe : `<p>${safe}</p>`
}
