<script setup lang="ts">
    import { Toaster } from 'vue-sonner'
    import 'vue-sonner/style.css'

    useHead({
        script: [
            // {
            //     src: 'https://o.alicdn.com/appflow/chatbot/v1/AppflowChatSDK.js',
            //     onload: () => {
            //         // @ts-ignore
            //         window.APPFLOW_CHAT_SDK?.init({
            //             integrateConfig: {
            //                 integrateId: 'cit-552d544bf79546a3878c',
            //                 domain: {
            //                     requestDomain:
            //                         'https://1094281040266220.appflow.aliyunnest.com',
            //                 },
            //             },
            //         })
            //     },
            // },
        ],
    })

    const { isLogin, verify } = useAuth()
    const { tryRefresh } = useHttp()
    const { t } = useLocale()

    const token = useCookie('token')
    const { current } = useTheme()

    const createArticle = () => {
        if (!isLogin.value) return
        navigateTo('/article/create')
    }

    // 右抽屉：回到顶部
    const backToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // 右抽屉：贴纸 Toast 测试（仅开发环境）——依次弹出四种类型，
    // 验证描边/模切白边/硬阴影、交错微倾与回弹进场
    // 注：import.meta 不能在模板表达式里使用（模板编译器非 module 上下文），
    // 需在 script 中求值后再交给模板
    const isDev = import.meta.dev
    const toast = useToast()
    const testToasts = () => {
        toast.success(t('toast_test_success'))
        setTimeout(() => toast.info(t('toast_test_info')), 260)
        setTimeout(() => toast.warning(t('toast_test_warning')), 520)
        setTimeout(() => toast.error(t('toast_test_error')), 780)
    }

    onMounted(async () => {
        if (token.value) {
            try {
                await verify({ token: token.value })
                isLogin.value = true
            } catch (e) {
                // access token 已过期：尝试用 refresh token 恢复登录态
                isLogin.value = await tryRefresh()
            }
        } else {
            isLogin.value = false
        }
    })
</script>
<template>
    <div>
        <NuxtLoadingIndicator :color="current.colors.primary" />
        <v-app>
            <!--        <v-layout>-->
            <v-navigation-drawer
                class="k-drawer--left"
                width="60"
                elevation="3"
            >
                <div
                    class="h-full d-flex flex-column align-center justify-center ga-6"
                >
                    <v-btn
                        v-permission
                        icon="mdi-circle-edit-outline"
                        variant="flat"
                        @click="createArticle"
                    >
                    </v-btn>
                    <span class="k-rail-brand" aria-hidden="true">
                        Kotae ✦ {{ t('hero_tagline') }}
                    </span>
                </div>
            </v-navigation-drawer>
            <AppBar />
            <v-navigation-drawer
                class="k-drawer--right"
                width="60"
                location="right"
                elevation="3"
            >
                <!-- 快捷入口栏：顶部花饰 / 中部导航图标 / 底部回到顶部 -->
                <div
                    class="h-full d-flex flex-column align-center justify-space-between pa-2"
                >
                    <span class="k-rail-spark text-primary" aria-hidden="true">
                        ✦
                    </span>
                    <div class="k-rail-toolbox">
                        <v-btn
                            class="k-rail-btn"
                            icon
                            size="x-small"
                            variant="text"
                            to="/"
                            :aria-label="t('cmd_home')"
                        >
                            <v-icon icon="mdi-home-variant-outline" size="18" />
                            <v-tooltip
                                activator="parent"
                                location="start"
                                :text="t('cmd_home')"
                                :open-delay="400"
                            />
                        </v-btn>
                        <template v-if="isLogin">
                            <v-btn
                                class="k-rail-btn"
                                icon
                                size="x-small"
                                variant="text"
                                to="/article/like"
                                :aria-label="t('like_list')"
                            >
                                <v-icon icon="mdi-heart-outline" size="18" />
                                <v-tooltip
                                    activator="parent"
                                    location="start"
                                    :text="t('like_list')"
                                    :open-delay="400"
                                />
                            </v-btn>
                            <v-btn
                                class="k-rail-btn"
                                icon
                                size="x-small"
                                variant="text"
                                to="/message"
                                :aria-label="t('message')"
                            >
                                <v-icon icon="mdi-message-outline" size="18" />
                                <v-tooltip
                                    activator="parent"
                                    location="start"
                                    :text="t('message')"
                                    :open-delay="400"
                                />
                            </v-btn>
                        </template>
                        <v-btn
                            class="k-rail-btn"
                            icon
                            size="x-small"
                            variant="text"
                            href="https://github.com/Touko-g/kotae_nuxt"
                            target="_blank"
                            rel="noopener"
                            aria-label="GitHub"
                        >
                            <v-icon icon="mdi-github" size="18" />
                            <v-tooltip
                                activator="parent"
                                location="start"
                                text="GitHub"
                                :open-delay="400"
                            />
                        </v-btn>
                    </div>
                    <div class="k-rail-toolbox k-rail-toolbox--single">
                        <v-btn
                            v-if="isDev"
                            class="k-rail-btn"
                            icon
                            size="x-small"
                            variant="text"
                            :aria-label="t('toast_test')"
                            @click="testToasts"
                        >
                            <v-icon icon="mdi-bell-ring-outline" size="18" />
                            <v-tooltip
                                activator="parent"
                                location="start"
                                :text="t('toast_test')"
                                :open-delay="400"
                            />
                        </v-btn>
                        <v-btn
                            class="k-rail-btn"
                            icon
                            size="x-small"
                            variant="text"
                            :aria-label="t('back_to_top')"
                            @click="backToTop"
                        >
                            <v-icon icon="mdi-arrow-up" size="18" />
                            <v-tooltip
                                activator="parent"
                                location="start"
                                :text="t('back_to_top')"
                                :open-delay="400"
                            />
                        </v-btn>
                    </div>
                </div>
            </v-navigation-drawer>
            <v-main class="bg-background k-paper">
                <slot />
            </v-main>
            <AppFooter />
            <Toaster />
            <!--        </v-layout>-->
        </v-app>
    </div>
</template>
