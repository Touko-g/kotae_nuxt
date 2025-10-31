<script setup lang="ts">
    const { t } = useLocale()
    const { show } = useSnakebar()
    const { rules } = useRules()
    const { getCode, register } = useAuth()
    const registerDialog = useState('register', () => false)

    const registerOptions = reactive({
        tab: 0,
        isLock: true,
        tabItems: ['get_code', 'create_account'],
    })

    const codeFormRef = useTemplateRef('codeFormRef')
    const codeForm = reactive({
        valid: false,
        email: '',
        loading: false,
    })

    const registerFormRef = useTemplateRef('registerFormRef')
    const registerForm = reactive({
        valid: false,
        username: '',
        about: '',
        email: '',
        code: '',
        password: '',
        password2: '',
        loading: false,
    })

    const checkPsw = (v: string) => {
        return registerForm.password === v
    }

    const password2Rules = [
        (v: string) => (!!v && !!v.trim()) || 'Password is required',
        (v: string) => checkPsw(v) || 'Password does not match',
    ]

    const handleCode = async () => {
        if (codeFormRef.value) {
            const { valid } = await codeFormRef.value.validate()
            if (valid) {
                try {
                    codeForm.loading = true
                    const { detail } = await getCode({ email: codeForm.email })
                    show(detail as string, 'success')
                    registerOptions.isLock = false
                } finally {
                    codeForm.loading = false
                }
            }
        }
    }

    const handleResetCode = () => {
        if (codeFormRef.value) {
            codeFormRef.value.reset()
        }
    }

    const handleRegister = async () => {
        if (registerFormRef.value) {
            const { valid } = await registerFormRef.value.validate()
            if (valid) {
                try {
                    registerForm.loading = true
                    await register({ ...registerForm })
                    show(t('register_success'), 'success')
                    registerDialog.value = false
                } finally {
                    registerForm.loading = false
                }
            }
        }
    }

    const handleResetRegister = () => {
        if (registerFormRef.value) {
            registerFormRef.value.reset()
        }
    }

    const handleClear = () => {
        handleResetCode()
        handleResetRegister()
        registerOptions.isLock = true
        registerOptions.tab = 0
    }

    const { tab, isLock, tabItems } = toRefs(registerOptions)
</script>

<template>
    <v-dialog
        v-model="registerDialog"
        fullscreen
        :scrim="false"
        transition="dialog-bottom-transition"
        @after-leave="handleClear"
    >
        <v-card class="overflow-auto scrollbar-hide">
            <template #prepend>
                <div class="d-flex align-center">
                    <v-btn
                        icon="mdi-close"
                        variant="flat"
                        @click="registerDialog = false"
                    ></v-btn>
                    <p class="ml-4 text-2xl">
                        {{ t('create_account') }}
                    </p>
                </div>
            </template>
            <v-card-item>
                <v-tabs
                    v-model="tab"
                    fixed-tabs
                    color="primary"
                    :disabled="isLock"
                >
                    <v-tab v-for="(v, k) in tabItems" :key="v" :value="k">
                        {{ t(`${v}`) }}
                    </v-tab>
                </v-tabs>
            </v-card-item>
            <v-card-text>
                <v-window v-model="tab" :touch="false">
                    <v-window-item :value="0">
                        <p class="text-sm text-uppercase">
                            {{ t('email_for_code') }}
                        </p>
                        <v-divider class="my-2" color="surface" />
                        <p class="text-sm text-grey mb-6">
                            {{ t('code_help') }}
                        </p>
                        <v-form
                            ref="codeFormRef"
                            v-model="codeForm.valid"
                            lazy-validation
                        >
                            <v-text-field
                                v-model="codeForm.email"
                                :label="t('email')"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                :rules="rules.emailRules"
                            >
                            </v-text-field>
                            <div class="d-flex">
                                <v-btn
                                    color="primary"
                                    variant="tonal"
                                    class="mr-1"
                                    :loading="codeForm.loading"
                                    @click="handleCode"
                                    >{{ t('get_code') }}
                                </v-btn>
                                <v-btn
                                    color="primary"
                                    variant="tonal"
                                    class="mr-1"
                                    @click="handleResetCode"
                                    >{{ t('clear') }}</v-btn
                                >
                                <v-btn
                                    color="primary"
                                    :disabled="isLock"
                                    @click="tab = 1"
                                    >{{ t('next') }}
                                </v-btn>
                            </div>
                        </v-form>
                    </v-window-item>
                    <v-window-item :value="1">
                        <p class="text-sm text-uppercase">
                            {{ t('user_for_account') }}
                        </p>
                        <v-divider class="my-2" color="surface" />
                        <p class="text-sm text-grey mb-6">
                            {{ t('account_help') }}
                        </p>
                        <v-form
                            ref="registerFormRef"
                            v-model="registerForm.valid"
                            lazy-validation
                        >
                            <v-text-field
                                v-model="registerForm.username"
                                :label="t('username')"
                                :rules="rules.nameRules"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                            >
                            </v-text-field>
                            <v-text-field
                                v-model="registerForm.email"
                                :label="t('email')"
                                :rules="rules.emailRules"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                            >
                            </v-text-field>
                            <v-text-field
                                v-model="registerForm.code"
                                :label="t('code')"
                                :rules="rules.codeRules"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                            >
                            </v-text-field>
                            <v-textarea
                                v-model="registerForm.about"
                                :label="t('about')"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                            >
                            </v-textarea>
                            <v-text-field
                                v-model="registerForm.password"
                                :label="t('password')"
                                :rules="rules.passwordRules"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                type="password"
                            >
                            </v-text-field>
                            <v-text-field
                                v-model="registerForm.password2"
                                :label="t('password2')"
                                :rules="password2Rules"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                type="password"
                            >
                            </v-text-field>
                            <div class="d-flex">
                                <v-btn
                                    color="primary"
                                    variant="tonal"
                                    class="mr-1"
                                    :loading="registerForm.loading"
                                    @click="handleRegister"
                                    >{{ t('sign_up') }}
                                </v-btn>
                                <v-btn
                                    color="primary"
                                    variant="tonal"
                                    class="mr-1"
                                    @click="handleResetRegister"
                                    >{{ t('clear') }}</v-btn
                                >
                            </div>
                        </v-form>
                    </v-window-item>
                </v-window>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<style scoped></style>
