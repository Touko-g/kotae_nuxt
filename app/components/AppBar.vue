<script setup lang="ts">
    const route = useRoute()
    const theme = useTheme()
    const { current, t } = useLocale()
    const { setLocale } = useDayjs()
    const loginDialog = useState('login')
    const { isLogin, logout } = useAuth()

    const user = useCookie<User | null>('user')
    const { show } = useSnakebar()
    const loading = useState('loading')

    const toggleLocal = () => {
        const newLocale = current.value === 'zh' ? 'en' : 'zh'
        current.value = newLocale
        setLocale(newLocale === 'zh' ? 'zh-cn' : 'en')
    }

    const handleLogout = async () => {
        const refresh = useCookie('refresh')
        const token = useCookie('token')
        if (refresh.value) {
            loading.value = true
            try {
                await logout({ refresh_token: refresh.value })
                isLogin.value = false
                refresh.value = null
                token.value = null
                user.value = null
                if (
                    !(
                        route.fullPath === '/' ||
                        route.fullPath.startsWith('/article')
                    )
                ) {
                    navigateTo('/')
                }
                show('已退出当前账号', 'success')
            } catch (e) {
            } finally {
                loading.value = false
            }
        }
    }
</script>

<template>
    <v-app-bar elevation="3">
        <v-app-bar-title class="text-primary" @click="navigateTo('/')">
            Kotae
        </v-app-bar-title>
        <v-spacer></v-spacer>
        <v-btn icon>
            <v-icon>mdi-magnify</v-icon>
        </v-btn>
        <v-btn icon>
            <v-icon>mdi-heart</v-icon>
        </v-btn>
        <v-btn icon @click="theme.toggle()">
            <v-icon>mdi-theme-light-dark</v-icon>
        </v-btn>
        <v-btn icon @click="toggleLocal">
            <v-icon>mdi-translate</v-icon>
        </v-btn>
        <v-divider v-if="!isLogin" inset vertical :opacity="0.7" class="mx-6" />
        <v-menu v-if="isLogin && user" location="bottom">
            <template #activator="{ props }">
                <v-btn icon v-bind="props">
                    <v-avatar>
                        <v-img :alt="user.username" :src="user.avatar" />
                    </v-avatar>
                </v-btn>
            </template>
            <v-list width="225">
                <v-list-item prepend-icon="mdi-message-reply-outline">
                    <div
                        class="w-100 d-flex justify-space-between align-center"
                    >
                        {{ t('message') }}
                    </div>
                </v-list-item>
                <v-list-item
                    prepend-icon="mdi-human"
                    @click="navigateTo(`/user/${user.id}`)"
                >
                    {{ t('about_me') }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-key">
                    {{ t('change_psw') }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-emoticon-lol-outline">
                    {{ t('public_chat') }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-palette">
                    {{ t('color_palette') }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-logout" @click="handleLogout">
                    {{ t('logout') }}
                </v-list-item>
            </v-list>
        </v-menu>
        <v-btn-group
            v-else
            density="comfortable"
            border
            divided
            color="primary"
        >
            <v-btn append-icon="mdi-login" @click="loginDialog = true"
                >login</v-btn
            >
            <!--            <v-btn append-icon="mdi-account-plus-outline">register</v-btn>-->
        </v-btn-group>
    </v-app-bar>
    <LoginDialog />
    <RegisterDialog />
    <ResetDialog />
    <FetchLoading />
</template>

<style scoped></style>
