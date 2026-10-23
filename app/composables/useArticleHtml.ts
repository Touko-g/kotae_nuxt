import DOMPurify from 'isomorphic-dompurify'
import type { Highlighter } from 'shiki'

/**
 * 正文渲染管线：Shiki 高亮 → DOMPurify 净化
 *
 * 两条不可回退的约束（都来自历史 bug）：
 * 1. 必须是 computed 派生，不能在 onMounted 里改写 article.content。
 *    在 onMounted 里做，SSR 首屏输出的就是后端原始 HTML（存储型 XSS 面：
 *    <img onerror> 在浏览器解析 SSR HTML 时就已经执行，来不及净化），
 *    而且原地改写会污染 useAsyncData 缓存，切换主题后代码块配色不再更新。
 * 2. 服务端没有 DOM。isomorphic-dompurify 在 node 条件下用 jsdom 承载，
 *    浏览器条件下解析到 browser 构建（仍是原生 DOMPurify），
 *    所以 jsdom 不会被打进客户端包。
 */

// 应用主题 → Shiki 主题：light / glass 为亮色系，dark / rainy 为暗色系
const SHIKI_THEMES: Record<string, string> = {
    light: 'github-light',
    glass: 'github-light',
    dark: 'github-dark',
    rainy: 'github-dark',
}

// 反转义 HTML 实体，让高亮器拿到真实源码
const decodeEntities = (code: string) =>
    code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

// 语言名允许 c++ / c# 这类带符号的写法
const CODE_BLOCK_RE =
    /<pre(?:\s+class="language-([\w+#.-]+)")?>\s*<code[^>]*?>([\s\S]*?)<\/code>\s*<\/pre>/g

// shiki 内置的纯文本语法：不在 getLoadedLanguages() 里，但 codeToHtml 认
const PLAIN_LANGS = ['text', 'plaintext', 'txt']

export interface ArticleHtmlOptions {
    /** 返回正文原始 HTML（后端返回的编辑器内容） */
    html: () => string | undefined
    /** 返回当前应用主题名，用于选择 Shiki 主题 */
    themeName: () => string
    highlighter: Highlighter
}

export const useArticleHtml = (options: ArticleHtmlOptions) => {
    const highlightCodeBlocks = (raw: string, themeName: string) => {
        const theme = SHIKI_THEMES[themeName] ?? 'github-light'
        const loaded = options.highlighter.getLoadedLanguages()

        return raw.replace(CODE_BLOCK_RE, (_, lang = 'text', code: string) => {
            // 没写语言的代码块按纯文本渲染：以前会兜底成 javascript，颜色全错
            const realLang =
                PLAIN_LANGS.includes(lang) || loaded.includes(lang)
                    ? lang
                    : 'javascript'
            return options.highlighter.codeToHtml(decodeEntities(code), {
                lang: realLang,
                theme,
            })
        })
    }

    const html = computed(() => {
        const raw = options.html()
        if (!raw) return ''
        // 先高亮再净化：高亮产物只含 class / style，净化后配色得以保留
        return DOMPurify.sanitize(
            highlightCodeBlocks(raw, options.themeName()),
            { USE_PROFILES: { html: true } }
        )
    })

    return { html }
}
