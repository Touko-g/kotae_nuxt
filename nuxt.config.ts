// https://nuxt.com/docs/api/configuration/nuxt-config
import type {
    Article,
    ArticleListResponse,
} from './app/composables/api/useArticle'
import pkg from './package.json'

export default defineNuxtConfig({
    app: {
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
                { property: 'og:url', content: 'https://kotae.cn' },
                { property: 'og:type', content: 'website' },
            ],
            link: [
                {
                    rel: 'stylesheet',
                    href: 'https://chinese-fonts-cdn.deno.dev/packages/maple-mono-cn/dist/MapleMono-CN-SemiBoldItalic/result.css',
                },
            ],
            noscript: [
                // <noscript>JavaScript is required</noscript>
                { textContent: 'JavaScript is required' },
            ],
        },
    },
    css: ['~/assets/css/main.css'],
    modules: [
        '@nuxtjs/i18n',
        'vuetify-nuxt-module',
        '@nuxtjs/tailwindcss',
        '@nuxtjs/sitemap',
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
        url: 'https://kotae.cn',
        name: 'Kotae',
    },
    sitemap: {
        autoLastmod: true,
        exclude: ['/admin/**'],
        urls: async () => {
            const fetchUrl = 'https://kotae.cn/api/article/'
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
                            url: `/article/${a.id}`,
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
    typescript: {
        typeCheck: false,
    },
    runtimeConfig: {
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_URL || 'https://kotae.cn/api/',
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
                },
            },
        },
    },
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
})
