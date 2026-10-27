/**
 * RSS 2.0 订阅源：`/rss.xml`
 *
 * 为什么放在 Nitro 而不是等后端加接口：`server/` 一直是空的，而文章列表接口
 * 本来就是公开的（不需要 token），Nitro 里拼一下就是一份可用的 feed，
 * 不依赖 Django 任何改动。
 *
 * 设计取舍：
 * - **全文而不是摘要**：`content:encoded` 放正文 HTML，阅读器里能直接读完；
 *   `description` 另给一段纯文本，给只认摘要的老阅读器兜底。
 * - **绝对链接**：正文里的 `/xxx` 在阅读器里没有 base，会 404，统一补成站点域名。
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

/** 正文里的 `/xxx` 相对地址补成绝对地址（`//cdn` 协议相对地址跳过） */
const absolutize = (html: string, siteUrl: string): string =>
    html.replace(/(\s(?:src|href)=")\/(?!\/)/g, `$1${siteUrl}/`)

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

    const items = articles
        .map(article => {
            const url = `${siteUrl}/article/${article.id}`
            const summary = summarize(article.content)
            const categories = (article.tag ?? [])
                .map(tag => `      <category>${escapeXml(tag.name)}</category>`)
                .join('\n')

            return [
                '    <item>',
                `      <title>${escapeXml(article.title)}</title>`,
                `      <link>${escapeXml(url)}</link>`,
                `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
                `      <pubDate>${toRfc822(article.create_time)}</pubDate>`,
                `      <dc:creator>${escapeXml(article.owner?.username ?? '')}</dc:creator>`,
                categories,
                `      <description>${cdata(summary)}</description>`,
                `      <content:encoded>${cdata(absolutize(article.content || '', siteUrl))}</content:encoded>`,
                '    </item>',
            ]
                .filter(Boolean)
                .join('\n')
        })
        .join('\n')

    const lastBuildDate = toRfc822(
        articles[0]?.update_time || articles[0]?.create_time
    )

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>Nuxt Nitro</generator>
    <atom:link href="${escapeXml(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

    setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
    // 订阅器不需要秒级新鲜度，给 CDN 留足合并窗口
    setHeader(
        event,
        'Cache-Control',
        'public, max-age=600, s-maxage=1800, stale-while-revalidate=86400'
    )
    return xml
})
