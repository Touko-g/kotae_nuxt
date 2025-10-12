<script setup lang="ts">
    const theme = useTheme()
    const { current, t } = useLocale()
    const { setLocale } = useDayjs()
    const loginDialog = useState('login')
    const { isLogin } = useAuth()

    const toggleLocal = () => {
        const newLocale = current.value === 'zh' ? 'en' : 'zh'
        current.value = newLocale
        setLocale(newLocale === 'zh' ? 'zh-cn' : 'en')
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
        <v-menu v-if="isLogin" location="bottom">
            <template #activator="{ props }">
                <v-btn icon v-bind="props">
                    <v-icon>mdi-dots-vertical</v-icon>
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
                <v-list-item prepend-icon="mdi-emoticon-lol-outline">
                    {{ t('public_chat') }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-palette">
                    {{ t('ct') }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-key">
                    {{ t('change_psw') }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-human">
                    {{ t('about_me') }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-logout">
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
</template>

<style scoped></style>
