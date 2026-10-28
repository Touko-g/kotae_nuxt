/**
 * RSS 2.0 订阅源：`/rss.xml`
 *
 * 为什么放在 Nitro 而不是等后端加接口：`server/` 一直是空的，而文章列表接口
 * 本来就是公开的（不需要 token），Nitro 里拼一下就是一份可用的 feed，
 * 不依赖 Django 任何改动。
 *
 * 设计取舍：
 * - **全文而不是摘要**：`content:encoded` 放正文 HTML，阅读器里能直接读完；
 *   `description` 给一段**带 HTML 标签**的摘要，给只认 description 的阅读器兜底。
 * - **description 必须是 HTML，不能是纯文本**：不少阅读器（Follow / 部分移动端）
 *   只读 description，转成纯文本后段落、列表、加粗全丢，看起来就是「没排版」。
 * - **绝对链接**：正文里的 `/xxx` 在阅读器里没有 base，会 404，统一补成站点域名。
 * - **不挂样式表**：浏览器打开就是原生 XML 树（Chrome 会提示「此 XML 文件没有样式
 *   信息」），这是刻意的。别加 `xml-stylesheet` —— Chrome 正在移除 XSLT 支持，
 *   访问时会弹红条警告；也别改成按 `Accept` 返回网页版，会让 feed 变成两种表示，
 *   缓存一旦串味阅读器就会拿到 HTML 解析失败。
 * - **失败不 500**：上游挂了就返回一个空 channel。订阅器遇到 5xx 会降低抓取
 *   频率甚至退订，返回空 feed 至少下次还能恢复。
 * - **带缓存头**：feed 是典型的「允许稍微旧一点」的资源，给 CDN 留
 *   `stale-while-revalidate`，避免每次抓取都打到后端。
 */
import { convert } from 'html-to-text'
import type { Article, ArticleListResponse } from '#shared/types/api'

const SITE_NAME = 'Kotae'
const SITE_DESCRIPTION = 'Kotae 记录 创作 分享，寻找你的答案'
/** 默认条数：够阅读器翻，又不至于让 feed 变成几百 KB */
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

/** XML 文本节点转义（属性值同样适用） */
const escapeXml = (input: string): string =>
    input.replace(/[&<>"']/g, char => {
        switch (char) {
            case '&':
                return '&amp;'
            case '<':
                return '&lt;'
            case '>':
                return '&gt;'
            case '"':
                return '&quot;'
            default:
                return '&apos;'
        }
    })

/**
 * CDATA 包裹。正文里出现 `]]>` 会提前闭合，按标准做法拆成两段 CDATA。
 */
const cdata = (input: string): string =>
    `<![CDATA[${input.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`

/** RSS 的 pubDate 要求 RFC 822；后端给的是 ISO 8601 */
const toRfc822 = (value?: string): string => {
    const date = value ? new Date(value) : new Date()
    return Number.isNaN(date.getTime())
        ? new Date().toUTCString()
        : date.toUTCString()
}

/** dc:date 要 ISO 8601，给样式表按 `substring(1,10)` 取日期用 */
const toIso8601 = (value?: string): string => {
    const date = value ? new Date(value) : new Date()
    return Number.isNaN(date.getTime())
        ? new Date().toISOString()
        : date.toISOString()
}

/** 正文里的 `/xxx` 相对地址补成绝对地址（`//cdn` 协议相对地址跳过） */
const absolutize = (html: string, siteUrl: string): string =>
    html.replace(/(\s(?:src|href)=")\/(?!\/)/g, `$1${siteUrl}/`)

/**
 * 去掉编辑器写进 HTML 的内部标记。
 *
 * TipTap / ProseMirror 会在每个块上挂 `data-start` / `data-end`（文档里的字符偏移量），
 * 这些对读者毫无意义，但会把 feed 撑大、在浏览器里看起来像一堆乱码。
 * 只删这两个属性，不碰其它 `data-*` —— 万一以后有 `data-language` 之类有意义的需要保留。
 */
const stripEditorAttrs = (html: string): string =>
    html.replace(/\s+data-(?:start|end)="[^"]*"/gi, '')

/**
 * 正文第一张图，作为条目的缩略图。
 *
 * 阅读器基本不会从 `content:encoded` 里自己抠图，只认 `<enclosure>` /
 * `<media:thumbnail>`。没有这两个字段时，列表视图和分享卡片就是一片空白。
 * 相对地址要补成绝对地址 —— 阅读器没有 base，`/img/a.png` 会直接 404。
 */
const pickCoverImage = (html: string, siteUrl: string): string => {
    const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? ''
    if (!src) return ''
    if (/^https?:\/\//i.test(src)) return src
    if (src.startsWith('//')) return `https:${src}`
    return `${siteUrl}${src.startsWith('/') ? '' : '/'}${src}`
}

/** `<enclosure>` 的 type 是必填项，按扩展名给一个，认不出来就按 jpeg */
const imageMime = (url: string): string => {
    const ext = (url.split('?')[0] ?? '').split('.').pop()?.toLowerCase() ?? ''
    const map: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        avif: 'image/avif',
        svg: 'image/svg+xml',
    }
    return map[ext] ?? 'image/jpeg'
}

/** 摘要：走和前端同一套 html-to-text 配置，避免两处文案风格不一致 */
const toPlainText = (html: string): string => {
    try {
        return convert(html || '', {
            wordwrap: false,
            selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' },
            ],
        })
    } catch {
        return ''
    }
}

/**
 * 截断成摘要。
 * 两处细节：行首行尾空白要归一化（html-to-text 会留下 ` \n ` 这种），
 * 否则阅读器和 Discord 里会显示成一堆碎行；截断后补省略号，
 * 不然读者看到的是 `* priva` 这种断在词中间的句子。
 */
const summarize = (html: string, max = 300): string => {
    const text = toPlainText(html)
        .replace(/[ \t\u00A0]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim()
    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

/** 摘要可以整块搬运的顶层块级标签（`li` 不列：它总是活在 ul/ol 里） */
const BLOCK_TAGS = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'blockquote',
    'pre',
    'figure',
    'table',
])

/**
 * 按「顶层块」切分 HTML。
 *
 * 不能用 `/<(ul|p|…)>[\s\S]*?<\/\1>/` 这种正则：正文里有嵌套列表时，
 * 非贪婪匹配会在**内层** `</ul>` 就收尾，切出 `<ul><li><ul>…</ul>` 这种
 * 标签不平衡的片段 —— feed 本身能解析（在 CDATA 里），但阅读器渲染会塌。
 * 这里用深度计数，只在深度归零处切分。
 */
const splitBlocks = (html: string): string[] => {
    const tagRe = /<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi
    const blocks: string[] = []
    let depth = 0
    let start = -1
    let match: RegExpExecArray | null

    while ((match = tagRe.exec(html))) {
        const isClose = match[1] === '/'
        const name = (match[2] ?? '').toLowerCase()
        if (!BLOCK_TAGS.has(name)) continue

        if (isClose) {
            // 多余的闭标签（原文本来就不平衡）直接忽略，别让 depth 变负
            if (depth === 0) continue
            depth--
            if (depth === 0 && start >= 0) {
                blocks.push(html.slice(start, tagRe.lastIndex))
                start = -1
            }
        } else {
            if (depth === 0) start = match.index
            depth++
        }
    }

    // depth 没归零说明原文有未闭合的块，尾部丢弃而不是硬塞进来
    return blocks
}

/** 只数正文字符，标签不计入预算 */
const textLength = (html: string): number =>
    toPlainText(html).replace(/\s+/g, '').length

/**
 * 压掉块内部的换行与连续空白。
 *
 * 编辑器写出来的 `<p>` 里常带着源码换行，HTML 里它等于一个空格、渲染上看不出差别，
 * 但在浏览器 XML 树里会把 description 拉成好几行，跟主流 feed 的观感对不上。
 * `<pre>` 例外 —— 那里的换行是代码格式的一部分，压了就没法读。
 */
const compactBlock = (block: string): string =>
    /^<pre[\s>]/i.test(block) ? block : block.replace(/\s+/g, ' ')

/**
 * 带 HTML 标签的摘要。
 *
 * 为什么不能沿用纯文本版：`description` 是大多数阅读器唯一会渲染的字段，
 * 一旦去掉标签，段落、列表、加粗全部消失，读者看到的就是一坨挤在一起的文字。
 *
 * 按整块累积而不是按字符 slice —— 切一半的 `<p>` 会让阅读器渲染出错。
 * 正文是一整段不分行的老文章（首块就超预算）时，退回纯文本截断兜底。
 */
const summarizeHtml = (html: string, max = 400): string => {
    const source = (html || '').trim()
    if (!source) return ''

    const blocks = splitBlocks(source)
    const picked: string[] = []
    let used = 0

    for (const block of blocks) {
        const length = textLength(block)
        if (length === 0) continue // 纯图片块，摘要里不要
        if (picked.length > 0 && used + length > max) break
        picked.push(compactBlock(block))
        used += length
        if (used >= max) break
    }

    // 首块就远超预算（整篇一个 <p>）→ 硬塞会把全文搬进摘要
    if (picked.length === 1 && used > max * 2) {
        const plain = summarize(picked[0] ?? '', max).replace(/\s+/g, ' ')
        return plain ? `<p>${plain}</p>` : ''
    }

    // 正文没有块级标签（纯文本 / 只有行内标签）→ 同样退回纯文本
    if (picked.length === 0) {
        const plain = summarize(source, max).replace(/\s+/g, ' ')
        return plain ? `<p>${plain}</p>` : ''
    }

    // 块之间不插换行：HTML 里换行等于空白，对渲染毫无影响，
    // 但会让 description 在浏览器 XML 树里被拆成好几行，跟主流 feed 的观感不一致
    return picked.join('')
}

export default defineEventHandler(async event => {
    const config = useRuntimeConfig(event)
    const configuredSiteUrl = String(config.public.siteUrl || '').replace(
        /\/+$/,
        ''
    )
    // siteUrl 没配就退回请求来源：否则 feed 里全是 `/article/1` 这种相对链接，
    // 阅读器没有 base 会直接打不开
    const siteUrl = configuredSiteUrl || getRequestURL(event).origin
    const apiBase = `${String(config.public.apiBase || '').replace(/\/+$/, '')}/`

    // ?limit=N 方便调试，同时限制上限，别让人一把拉走全部文章
    const rawLimit = Number(getQuery(event).limit)
    const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT)
        : DEFAULT_LIMIT

    let articles: Article[] = []
    try {
        const data = await $fetch<ArticleListResponse>(`${apiBase}article/`, {
            query: { page: 1, pagesize: limit, order: '-create_time' },
            timeout: 8000,
        })
        articles = data?.results ?? []
    } catch (error) {
        // 上游不可用时仍然返回结构合法的空 feed，见文件头说明。
        // 服务端没有 UI 可以提示，只能落日志，所以这里必须用 console。
        // eslint-disable-next-line no-console
        console.error('[rss] 拉取文章列表失败：', error)
    }

    // 先整理成「与输出格式无关」的中间结构
    const entries = articles.map(article => {
        const isoDate = toIso8601(article.create_time)
        // 编辑器属性先洗掉，摘要和全文都不该带
        const body = stripEditorAttrs(article.content || '')
        return {
            url: `${siteUrl}/article/${article.id}`,
            title: article.title,
            author: article.owner?.username ?? '',
            categories: (article.tag ?? []).map(tag => tag.name),
            pubDate: toRfc822(article.create_time),
            isoDate,
            // 摘要里的图片 / 链接同样是相对地址，跟着正文一起绝对化
            summary: absolutize(summarizeHtml(body), siteUrl),
            content: absolutize(body, siteUrl),
            cover: pickCoverImage(body, siteUrl),
        }
    })

    const lastBuildDate = toRfc822(
        articles[0]?.update_time || articles[0]?.create_time
    )
    const feedUrl = `${siteUrl}/rss.xml`

    const items = entries
        .map(entry => {
            const categories = entry.categories
                .map(name => `      <category>${escapeXml(name)}</category>`)
                .join('\n')

            return [
                '    <item>',
                `      <title>${escapeXml(entry.title)}</title>`,
                `      <link>${escapeXml(entry.url)}</link>`,
                `      <guid isPermaLink="true">${escapeXml(entry.url)}</guid>`,
                `      <pubDate>${entry.pubDate}</pubDate>`,
                `      <dc:date>${escapeXml(entry.isoDate)}</dc:date>`,
                `      <dc:creator>${escapeXml(entry.author)}</dc:creator>`,
                categories,
                // description 用转义而不是 CDATA：两者解析结果完全一样，
                // 但转义形式（`&lt;p&gt;`）对老旧解析器兼容性更好，浏览器里也更直观。
                // content:encoded 仍用 CDATA —— 全文太长，转义会让体积接近翻倍。
                `      <description>${escapeXml(entry.summary)}</description>`,
                `      <content:encoded>${cdata(entry.content)}</content:encoded>`,
                // 缩略图两种写法都给：enclosure 是 RSS 2.0 标准，
                // media:thumbnail 是 Feedly / Inoreader 这类阅读器实际更常读的
                entry.cover
                    ? `      <enclosure url="${escapeXml(entry.cover)}" type="${imageMime(entry.cover)}" length="0" />`
                    : '',
                entry.cover
                    ? `      <media:thumbnail url="${escapeXml(entry.cover)}" />`
                    : '',
                '    </item>',
            ]
                .filter(Boolean)
                .join('\n')
        })
        .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>Nuxt Nitro</generator>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

    // 必须是 application/xml，不能是 application/rss+xml。
    // 两者的差别不只是「语义更准确」—— Chrome 只对 application/xml / text/xml
    // 启用内置的 XML 查看器（语法高亮 + 折叠 + 顶部提示条），
    // 遇到 application/rss+xml 会直接当纯文本平铺，看起来就是一坨单色文字。
    // 代价：Firefox 的 Feed Preview 只认 application/rss+xml / atom+xml，
    // 改完它不会再显示订阅引导页，但也只是显示成 XML 树，不影响订阅本身。
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
    // 订阅器不需要秒级新鲜度，给 CDN 留足合并窗口
    setHeader(
        event,
        'Cache-Control',
        'public, max-age=600, s-maxage=1800, stale-while-revalidate=86400'
    )
    return xml
})
