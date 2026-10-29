// https://nuxt.com/docs/api/configuration/nuxt-config
import type { Article, ArticleListResponse } from './shared/types/api'
import pkg from './package.json'

// 站点地址与 API 地址统一从这里取：本地 / 预览环境可用环境变量覆盖，
// 避免 canonical、og:url、sitemap 指向线上域名
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://kotae.cn'
const apiBase = process.env.NUXT_PUBLIC_API_URL || 'https://kotae.cn/api/'
// 腾讯云 COS 直传配置（前端可见，非敏感）
const cosBucket = process.env.NUXT_PUBLIC_COS_BUCKET || 'chen-1302611521'
const cosRegion = process.env.NUXT_PUBLIC_COS_REGION || 'ap-nanjing'

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
                // PWA：Chrome 会读 manifest 里的 theme_color，iOS 只认这个 meta
                { name: 'theme-color', content: '#e41b23' },
                { name: 'mobile-web-app-capable', content: 'yes' },
                { name: 'apple-mobile-web-app-capable', content: 'yes' },
                { name: 'apple-mobile-web-app-title', content: 'Kotae' },
                {
                    name: 'apple-mobile-web-app-status-bar-style',
                    content: 'default',
                },

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
            // 让浏览器 / 阅读器自动发现订阅源（/rss.xml 由 server/routes/rss.xml.ts 提供）
            link: [
                {
                    rel: 'alternate',
                    type: 'application/rss+xml',
                    title: 'Kotae',
                    href: `${siteUrl}/rss.xml`,
                },
                // iOS 不认 manifest 里的 icons，也不吃 SVG，必须单独给一张 PNG
                {
                    rel: 'apple-touch-icon',
                    sizes: '180x180',
                    href: '/apple-touch-icon.png',
                },
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
        '@vite-pwa/nuxt',
    ],
    /**
     * PWA：可安装 + 离线读文章。
     *
     * 站点是 SSR（Nitro 常驻），没有预渲染的 index.html，所以不能用 Workbox 的
     * navigateFallback（它指望缓存里有一份 `/`）—— 离线导航交给 runtimeCaching
     * 里的 NetworkFirst 处理，访问过的页面自然进缓存。
     *
     * 另外 3710 个字体分片（约 148MB）必须挡在 precache 之外，否则首次安装
     * 要把整套中文字体拉一遍；字体改走运行时 CacheFirst，用到哪个存哪个。
     */
    pwa: {
        registerType: 'prompt',
        manifest: {
            name: 'Kotae',
            short_name: 'Kotae',
            description: '记录 · 创作 · 分享，寻找你的答案',
            lang: 'zh-CN',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            background_color: '#F9FAFB',
            theme_color: '#e41b23',
            categories: ['blog', 'news'],
            icons: [
                {
                    src: '/pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                },
                {
                    src: '/pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                },
                {
                    // 红底 + 中心 78% 的图标：Android 会把图标裁成圆形 / 水滴，
                    // 内容必须落在中间的安全区里
                    src: '/pwa-maskable-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                },
            ],
            shortcuts: [
                {
                    name: '写文章',
                    short_name: '写文章',
                    url: '/article/create',
                },
                { name: '标签云', short_name: '标签', url: '/tags' },
                { name: '归档', short_name: '归档', url: '/archive' },
            ],
        },
        workbox: {
            navigateFallback: null,
            cleanupOutdatedCaches: true,
            globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            globIgnores: ['**/*.woff2', '**/*.woff', '**/*.ttf', '**/*.eot'],
            runtimeCaching: [
                {
                    /**
                     * 文章配图在 COS 上，基本不会变，长缓存。
                     *
                     * 顺序有讲究：Workbox 按数组顺序匹配，先命中先返回。这条必须排在
                     * 页面规则前面 —— 页面规则是「任意 origin + 无扩展名路径」的宽松
                     * 正则，放前面会把 COS 图片也吃掉。
                     */
                    urlPattern:
                        /^https:\/\/[\w-]+\.cos\.[\w-]+\.myqcloud\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'cos-images',
                        expiration: {
                            maxEntries: 80,
                            maxAgeSeconds: 60 * 60 * 24 * 30,
                        },
                        cacheableResponse: { statuses: [0, 200] },
                    },
                },
                {
                    // 字体分片没进 precache（见 globIgnores），用到哪个存哪个
                    urlPattern: /\.(?:woff2?|ttf|eot)(?:[?#]|$)/i,
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'fonts',
                        expiration: {
                            maxEntries: 40,
                            maxAgeSeconds: 60 * 60 * 24 * 365,
                        },
                        cacheableResponse: { statuses: [0, 200] },
                    },
                },
                {
                    /**
                     * 页面导航：先走网络，3 秒没回来就吃缓存 —— 离线时读过的文章照常打开。
                     *
                     * generateSW 模式下 urlPattern 不能写成函数（要序列化进 sw.js），
                     * 只能给正则；而 RegExpRoute 对同源请求只要求「部分匹配」，
                     * 所以这里得把 origin 也写进去，否则 `^\/` 永远匹配不到
                     * `https://kotae.cn/article/5`。origin 写成通配是为了让 preview /
                     * 换域名的构建也能命中。
                     *
                     * 排除法：`_nuxt/` 和 `api/` 按前缀挡，其余静态资源靠「路径里
                     * 没有扩展名」挡 —— 逐个枚举 .js/.css/.png 不如这条稳。
                     * 扩展名上限放到 11 位是为了盖住 .webmanifest / .avif。
                     */
                    urlPattern:
                        /^https?:\/\/[^/]+\/(?!_nuxt\/|api\/)(?![^?#]*\.[a-z0-9]{2,11}(?:[?#]|$))/i,
                    handler: 'NetworkFirst',
                    options: {
                        cacheName: 'pages',
                        networkTimeoutSeconds: 3,
                        expiration: {
                            maxEntries: 50,
                            maxAgeSeconds: 60 * 60 * 24 * 7,
                        },
                        cacheableResponse: { statuses: [0, 200] },
                    },
                },
            ],
        },
        client: {
            // 不用自定义安装按钮：浏览器自带的安装入口已经够用
            installPrompt: false,
        },
    },
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
        // ---- AI 能力已迁到 Django 后端 ----
        // 上游密钥不再经过前端：每个用户在自己的「AI 设置」里填 key，
        // 后端加密存库、按用户计费。这里没有任何服务端密钥要配。
        public: {
            apiBase,
            siteUrl,
            cosBucket,
            cosRegion,
            // 站点级开关，与「有没有配 key」无关：
            // 关掉时前端不渲染任何 AI 入口（部署环境设 NUXT_PUBLIC_AI_ENABLED=false）。
            // 是否可用最终由「已登录 + 已配置 key」决定，见 useAiClient()。
            aiEnabled: true,
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
                    // 已知限制：light 与 dark 共用同一个 secondary (#03DAC6)，
                    // 所以由 secondary 派生的圆环花饰(--k-accent-b)、星芒(--k-accent-d)、
                    // 贴纸标签、热门榜 #2 徽章、撒花在明暗切换时颜色不变。
                    // 曾试过拆成 light 靛蓝 / dark 天青，配色观感不佳已回退。
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
                    // 终端：磷光绿点阵屏。底色压到近黑（留一点绿偏，屏幕不发灰），
                    // 主色是显像管绿、副色取琥珀（老终端的告警色），装饰层见 main.css
                    terminal: {
                        dark: true,
                        colors: {
                            background: '#050807',
                            surface: '#0B1310',
                            primary: '#2BE86E',
                            secondary: '#FFB000',
                            error: '#FF5A6E',
                            info: '#4DA3FF',
                            success: '#38D9A9',
                            warning: '#FFC53D',
                        },
                    },
                },
            },
        },
    },
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
})
