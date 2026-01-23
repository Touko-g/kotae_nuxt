<script setup lang="ts">
    import { Toaster } from 'vue-sonner'
    import 'vue-sonner/style.css'

    useHead({
        script: [
            {
                src: 'https://o.alicdn.com/appflow/chatbot/v1/AppflowChatSDK.js',
                onload: () => {
                    // @ts-ignore
                    window.APPFLOW_CHAT_SDK?.init({
                        integrateConfig: {
                            integrateId: 'cit-552d544bf79546a3878c',
                            domain: { requestDomain: 'https://kotae.cn' },
                        },
                    })
                },
            },
        ],
    })

    const { isLogin, verify } = useAuth()

    const token = useCookie('token')
    const { current } = useTheme()

    const createArticle = () => {
        if (!isLogin.value) return
        navigateTo('/article/create')
    }

    onMounted(async () => {
        if (token.value) {
            try {
                await verify({ token: token.value })
                isLogin.value = true
            } catch (e) {}
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
            <v-navigation-drawer width="60" elevation="3">
                <div class="h-full flex items-center justify-center">
                    <v-btn
                        v-permission
                        icon="mdi-circle-edit-outline"
                        variant="flat"
                        @click="createArticle"
                    >
                    </v-btn>
                </div>
            </v-navigation-drawer>
            <AppBar />
            <v-navigation-drawer
                width="60"
                location="right"
                elevation="3"
                disable-resize-watcher
            >
            </v-navigation-drawer>
            <v-main class="bg-background">
                <slot />
            </v-main>
            <snake-bar />
            <Toaster />
            <!--        </v-layout>-->
        </v-app>
    </div>
</template>
