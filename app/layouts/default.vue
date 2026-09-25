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
            <snake-bar />
            <Toaster />
            <!--        </v-layout>-->
        </v-app>
    </div>
</template>
