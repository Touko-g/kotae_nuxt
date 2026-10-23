// https://nuxt.com/docs/api/configuration/nuxt-config
import type {
    Article,
    ArticleListResponse,
} from './app/composables/api/useArticle'
import pkg from './package.json'

// 站点地址与 API 地址统一从这里取：本地 / 预览环境可用环境变量覆盖，
// 避免 canonical、og:url、sitemap 指向线上域名
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://kotae.cn'
const apiBase = process.env.NUXT_PUBLIC_API_URL || 'https://kotae.cn/api/'
// 腾讯云 COS 直传配置（前端可见，非敏感）
const cosBucket = process.env.NUXT_PUBLIC_COS_BUCKET || 'chen-1302611521'
const cosRegion = process.env.NUXT_PUBLIC_COS_REGION || 'ap-nanjing'

/**
 * 环境变量读出来永远是字符串，直接 `process.env.X || 0.7` 会得到
 * `string | number`，而 runtimeConfig 里这几项声明的是 number。
 * 这里显式转一次；空串 / 非数字才回退到默认值（注意 0 是合法值，
 * 比如 aiRateLimit = 0 表示关闭限流，不能被 `||` 吃掉）。
 */
const envNumber = (value: string | undefined, fallback: number) => {
    if (value === undefined || value.trim() === '') return fallback
    const parsed = Number(value)
    return Number.isNaN(parsed) ? fallback : parsed
}

export default defineNuxtConfig({
    app: {
        pageTransition: { name: 'page', mode: 'out-in' },
        head: {
            title: 'Kotae',
            htmlAttrs: {
                lang: 'en',
            },
            meta: [
                {
                    name: 'google-site-verification',
                    content: 'yR4QyyvDQSCcGrTjxZFErJmIs4Bp_FVOmqm3rzVNTA0',
                },
                {
                    name: 'description',
                    content: 'Kotae 记录 创作 分享，寻找你的答案',
                },
                { name: 'robots', content: 'index, follow' },

                // Open Graph
                { property: 'og:title', content: 'Kotae - 记录 · 创作 · 分享' },
                {
                    property: 'og:description',
                    content: 'Kotae 记录 创作 分享，寻找你的答案',
                },
                { property: 'og:url', content: siteUrl },
                { property: 'og:type', content: 'website' },
            ],
            noscript: [
                // <noscript>JavaScript is required</noscript>
                { textContent: 'JavaScript is required' },
            ],
        },
    },
    css: [
        '~/assets/css/main.css',
        '@chinese-fonts/maple-mono-cn/dist/MapleMono-CN-SemiBoldItalic/result.css',
        '@mdi/font/css/materialdesignicons.min.css',
    ],
    modules: [
        '@nuxtjs/i18n',
        'vuetify-nuxt-module',
        '@nuxtjs/tailwindcss',
        '@nuxtjs/sitemap',
        '@nuxtjs/robots',
    ],
    i18n: {
        defaultLocale: 'en',
        locales: [
            {
                code: 'en',
                name: 'English',
            },
            {
                code: 'zh',
                name: '简体中文',
            },
        ],
    },
    site: {
        url: siteUrl,
        name: 'Kotae',
    },
    sitemap: {
        autoLastmod: true,
        exclude: ['/admin/**'],
        urls: async () => {
            const fetchUrl = `${apiBase}article/`
            const urls = []
            let page = 1
            let totalPages = 1

            while (page <= totalPages) {
                try {
                    const res = await fetch(`${fetchUrl}?page=${page}`)

                    if (!res.ok) {
                        break
                    }

                    const data: ArticleListResponse = await res.json()

                    totalPages = Math.ceil(data.count / 10)
                    page += 1
                    urls.push(
                        ...data.results.map((a: Article) => ({
                            // 字段名是 loc，不是 url —— 写 url 会被 sitemap 模块当成
                            // 「没有地址的条目」直接丢掉，文章页进不了 sitemap
                            loc: `/article/${a.id}`,
                            lastmod: a.update_time || new Date().toISOString(),
                        }))
                    )
                } catch (error) {
                    break
                }
            }

            return urls
        },
    },
    robots: {
        groups: [
            {
                userAgent: '*',
                allow: '/',
                disallow: '/admin',
            },
        ],
    },
    typescript: {
        typeCheck: false,
    },
    runtimeConfig: {
        // ---- Qwen（阿里云百炼 DashScope）服务端配置：不进客户端 bundle ----
        // 密钥只在这里读，前端一律走 /api/ai/* 代理
        aiApiKey: process.env.NUXT_AI_API_KEY || '',
        // OpenAI 兼容模式；新加坡站用 https://dashscope-intl.aliyuncs.com/compatible-mode/v1
        aiBaseUrl:
            process.env.NUXT_AI_BASE_URL ||
            'https://dashscope.aliyuncs.com/compatible-mode/v1',
        aiModel: process.env.NUXT_AI_MODEL || 'qwen3.8-flash',
        aiTemperature: envNumber(process.env.NUXT_AI_TEMPERATURE, 0.7),
        aiMaxTokens: envNumber(process.env.NUXT_AI_MAX_TOKENS, 2048),
        // 单次上游请求超时（毫秒）
        aiTimeout: envNumber(process.env.NUXT_AI_TIMEOUT, 60000),
        // 单 IP 限流：窗口内允许的请求数 / 窗口毫秒数，0 表示关闭
        aiRateLimit: envNumber(process.env.NUXT_AI_RATE_LIMIT, 20),
        aiRateWindow: envNumber(process.env.NUXT_AI_RATE_WINDOW, 60000),
        public: {
            apiBase,
            siteUrl,
            cosBucket,
            cosRegion,
            // 仅暴露「有没有配密钥」的布尔值，供 UI 决定是否显示 AI 入口
            aiEnabled: Boolean(process.env.NUXT_AI_API_KEY),
            versions: {
                nuxt: {
                    version: pkg.dependencies.nuxt,
                    icon: 'mdi-nuxt',
                    theme: 'green darken-2',
                    link: 'https://nuxt.com/docs',
                },
                vue: {
                    version: pkg.dependencies.vue,
                    icon: 'mdi-vuejs',
                    theme: 'green lighten-1',
                    link: 'https://vuejs.org/',
                },
                'vue-router': {
                    version: pkg.dependencies['vue-router'],
                    icon: 'mdi-vuejs',
                    theme: 'teal lighten-1',
                    link: 'https://router.vuejs.org/',
                },
                vuetify: {
                    version: '^3.7.0',
                    icon: 'mdi-vuetify',
                    theme: 'blue darken-2',
                    link: 'https://vuetifyjs.com/',
                },
            },
        },
    },
    imports: {
        dirs: ['composables/api'],
    },
    vuetify: {
        vuetifyOptions: {
            defaults: {
                VProgressLinear: {
                    color: 'primary',
                    height: 2,
                },
            },
            icons: {
                defaultSet: 'mdi',
                sets: 'mdi',
            },
            theme: {
                defaultTheme: 'light',
                themes: {
                    light: {
                        colors: {
                            background: '#F9FAFB',
                            surface: '#FFFFFF',
                            primary: '#e41b23',
                            secondary: '#03DAC6',
                            error: '#B00020',
                            info: '#2196F3',
                            success: '#4CAF50',
                            warning: '#FB8C00',
                        },
                    },
                    dark: {
                        colors: {
                            background: '#121212',
                            surface: '#1E1E1E',
                            primary: '#349d17',
                            secondary: '#03DAC6',
                            error: '#B00020',
                            info: '#2196F3',
                            success: '#4CAF50',
                            warning: '#FB8C00',
                        },
                    },
                    // 雨夜闪电：深藏雨夜空 + 闪电金主色
                    rainy: {
                        dark: true,
                        colors: {
                            background: '#0B1120',
                            surface: '#141E33',
                            primary: '#F7C948',
                            secondary: '#5F8BE0',
                            error: '#FF7070',
                            info: '#4DA3FF',
                            success: '#4CAF50',
                            warning: '#FB8C00',
                        },
                    },
                    // 玻璃磨砂：浅蓝雾底 + 半透表面（配合 main.css 的 backdrop-blur）
                    glass: {
                        colors: {
                            background: '#EAF0FA',
                            surface: '#FFFFFF',
                            primary: '#4C6EF5',
                            secondary: '#22B8CF',
                            error: '#B00020',
                            info: '#2196F3',
                            success: '#4CAF50',
                            warning: '#FB8C00',
                        },
                    },
                },
            },
        },
    },
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
})
