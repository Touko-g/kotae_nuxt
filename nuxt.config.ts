// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    app: {
        head: {
            title: 'Kotae',
            meta: [
                // <meta name="viewport" content="width=device-width, initial-scale=1">
                {
                    charset: 'utf-8',
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1',
                },
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
    modules: ['@nuxtjs/i18n', 'vuetify-nuxt-module', '@nuxtjs/tailwindcss'],
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
    typescript: {
        typeCheck: false,
    },
    runtimeConfig: {
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_URL || 'https://kotae.cn/api/',
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
