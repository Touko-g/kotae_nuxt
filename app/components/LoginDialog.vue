<script setup lang="ts">
    const { t } = useLocale()
    const { login, isLogin } = useAuth()
    const { getUser } = useUser()
    const { show } = useSnakebar()
    const { rules } = useRules()
    const loginDialog = useState('login', () => false)
    const registerDialog = useState('register')
    const resetDialog = useState('reset')

    const token = useCookie('token')
    const refreshToken = useCookie('refresh')
    const user = useCookie('user')

    const formRef = useTemplateRef('formRef')

    const loginForm = reactive({
        valid: false,
        username: '',
        password: '',
        loading: false,
    })

    const decodeJwt = (token: string) => {
        try {
            const base64Url = token.split('.')[1] || ''
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(
                        c =>
                            '%' +
                            ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                    )
                    .join('')
            )
            return JSON.parse(jsonPayload)
        } catch (err) {
            return null
        }
    }

    const handleLogin = async () => {
        if (formRef.value) {
            const { valid } = await formRef.value.validate()
            if (valid) {
                try {
                    loginForm.loading = true
                    const { access, refresh } = await login({
                        username: loginForm.username,
                        password: loginForm.password,
                    })

                    token.value = access
                    refreshToken.value = refresh

                    await nextTick()

                    const jwtInfo = decodeJwt(token.value)

                    user.value = JSON.stringify(await getUser(jwtInfo.user_id))

                    isLogin.value = true
                    loginDialog.value = false

                    show(t('login_success'), 'success')
                } catch (e) {
                } finally {
                    loginForm.loading = false
                }
            }
        }
    }

    const handleClear = () => {
        if (formRef.value) {
            formRef.value.reset()
        }
    }
</script>

<template>
    <v-dialog
        v-model="loginDialog"
        max-width="900"
        persistent
        @after-leave="handleClear"
    >
        <v-card class="overflow-hidden">
            <v-card-text
                ><v-row>
                    <v-col cols="12">
                        <div
                            class="text-uppercase text-2xl flex justify-between items-center"
                        >
                            {{ t('sign_in') }}
                            <v-btn
                                icon="mdi-close"
                                variant="flat"
                                @click="loginDialog = false"
                            />
                        </div>
                    </v-col>
                    <v-col cols="12" sm="6">
                        <p class="text-base text-uppercase">
                            {{ t('sign_in_sub') }}
                        </p>
                        <v-divider class="my-2" color="surface" />
                        <p class="text-sm text-grey mb-6">
                            {{ t('sign_in_help') }}
                        </p>
                        <v-form
                            ref="formRef"
                            v-model="loginForm.valid"
                            lazy-validation
                        >
                            <v-text-field
                                v-model="loginForm.username"
                                :label="t('username')"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                autocomplete="username"
                                :rules="rules.nameRules"
                                @keyup.enter="handleLogin"
                            >
                            </v-text-field>
                            <v-text-field
                                v-model="loginForm.password"
                                :label="t('password')"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                type="password"
                                autocomplete="password"
                                :rules="rules.passwordRules"
                                @keyup.enter="handleLogin"
                            ></v-text-field>
                            <div class="d-flex justify-space-between align-end">
                                <div class="d-flex">
                                    <v-btn
                                        color="primary"
                                        variant="tonal"
                                        class="mr-1"
                                        :loading="loginForm.loading"
                                        @click="handleLogin"
                                        >{{ t('sign_in') }}
                                    </v-btn>
                                    <v-btn
                                        color="primary"
                                        variant="tonal"
                                        @click="handleClear"
                                        >{{ t('clear') }}</v-btn
                                    >
                                </div>
                                <p
                                    class="text-primary text-decoration-none cursor-pointer"
                                    @click="resetDialog = true"
                                >
                                    {{ t('forget_psw') }}
                                </p>
                            </div>
                        </v-form>
                    </v-col>
                    <v-col cols="12" sm="6">
                        <p class="text-base text-uppercase">
                            {{ t('register') }}
                        </p>
                        <v-divider class="my-2" color="surface" />
                        <p class="text-sm text-grey mb-6">
                            {{ t('register_help') }}
                        </p>
                        <v-btn
                            color="primary"
                            rounded
                            @click="registerDialog = true"
                            >{{ t('create_account') }}</v-btn
                        >
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<style scoped></style>
