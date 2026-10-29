import { THEME_ORDER } from '~/composables/useThemeCycle'

const THEME_COOKIE = 'theme'

/**
 * 主题持久化
 *
 * 用 cookie 而不是 localStorage：cookie 会随请求带到服务端，
 * SSR 首屏就能用上次的主题渲染（主题类与 --v-theme-* 变量直接进 HTML），
 * 刷新时不会先闪一帧默认的 light。localStorage 只能在客户端读，必然闪。
 *
 * 放在插件里而不是 useThemeCycle 里：useThemeCycle 只在 AppBar / 命令面板里调用，
 * 首屏未必执行；插件在每次请求/加载时都会跑，能覆盖所有入口。
 */
export default defineNuxtPlugin({
    name: 'theme-persist',
    // 必须排在 vuetify 插件之后，才能拿到 nuxtApp.$vuetify。
    // 这里两个模式的名字都写上：运行时不存在的那个会被忽略（未注册的依赖不参与等待）。
    dependsOn: ['vuetify:nuxt:client:plugin', 'vuetify:nuxt:server:plugin'],
    setup(nuxtApp) {
        const themeName = nuxtApp.$vuetify?.theme.global.name
        if (!themeName) return

        const themeCookie = useCookie<string | null>(THEME_COOKIE, {
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
            path: '/',
        })

        // 恢复上次主题：服务端与客户端执行同一份逻辑，保证水合前后一致
        const saved = themeCookie.value
        if (saved && (THEME_ORDER as readonly string[]).includes(saved)) {
            themeName.value = saved
        } else if (saved && import.meta.client) {
            // 旧版存着已下线的主题名（比如删掉的 rainy / glass）：清掉。
            // 不清也不会出错 —— 每次都会落回默认值 —— 但留着的话，哪天重新
            // 上线同名主题就会「诈尸」；清理只在客户端做，避免 SSR 发 Set-Cookie
            themeCookie.value = null
        }

        // 只在客户端回写，避免 SSR 期间产生无意义的 Set-Cookie
        if (import.meta.client) {
            watch(themeName, name => {
                themeCookie.value = name
            })
        }
    },
})
