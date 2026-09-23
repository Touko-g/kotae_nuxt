<script setup lang="ts">
    definePageMeta({
        middleware: 'auth',
    })
    useSeoMeta({
        title: computed(() => t('change_psw')),
        ogTitle: computed(() => t('change_psw')),
    })

    const { t } = useLocale()
    const { show } = useSnackbar()

    const { logout } = useAuth()
    const { editPassword } = useUser()

    const isLogin = useState('isLogin')
    const refreshToken = useCookie('refresh')
    const user = useCookie<User | null>('user')

    const form = useTemplateRef('form')
    const data = reactive({
        valid: true,
        old_password: '',
        password: '',
        password2: '',
        loading: false,
        oldPswRules: [
            (v: string) => (!!v && !!v.trim()) || t('password_required'),
        ],
        pswRules: [
            (v: string) => (!!v && !!v.trim()) || t('new_password_required'),
            (v: string) => (v && v.length >= 8) || t('password_too_short'),
            (v: string) => checkPsw1(v) || t('password_same_as_old'),
        ],
        psw2Rules: [
            (v: string) =>
                (!!v && !!v.trim()) || t('confirm_password_required'),
            (v: string) => checkPsw(v) || t('password_not_match'),
        ],
    })

    onMounted(async () => {})

    const checkPsw1 = (v: string): boolean => {
        return data.old_password !== data.password
    }

    const checkPsw = (v: string): boolean => {
        return data.password === data.password2
    }

    const handleEdit = async () => {
        if (form.value && user.value && refreshToken.value) {
            form.value.validate()
            const { valid } = await form.value.validate()
            if (valid) {
                try {
                    data.loading = true
                    await editPassword(user.value.id, {
                        old_password: data.old_password,
                        password: data.password,
                        password2: data.password2,
                    })

                    await logout({ refresh_token: refreshToken.value })
                    const cookies = ['user', 'refresh', 'token']
                    cookies.forEach(name => (useCookie(name).value = null))
                    isLogin.value = false
                    navigateTo('/')
                    show(t('change_password_success'), 'success')
                } catch (error) {
                } finally {
                    data.loading = false
                }
            }
        }
    }

    const handleReset = () => {
        form.value && form.value.reset()
    }
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
        <v-row class="d-flex justify-center">
            <v-card width="500" variant="text" class="mt-12 pa-6" rounded="lg">
                <v-form ref="form" v-model="data.valid" lazy-validation>
                    <v-text-field
                        v-model="data.old_password"
                        :label="t('old_psw')"
                        type="password"
                        autocomplete="current-password"
                        :rules="data.oldPswRules"
                        color="primary"
                        variant="outlined"
                        density="comfortable"
                        class="mb-4"
                        clearable
                    />
                    <v-text-field
                        v-model="data.password"
                        :label="t('new_psw')"
                        type="password"
                        autocomplete="new-password"
                        :rules="data.pswRules"
                        color="primary"
                        variant="outlined"
                        density="comfortable"
                        class="mb-4"
                        clearable
                    />
                    <v-text-field
                        v-model="data.password2"
                        :label="t('confirm_psw')"
                        type="password"
                        autocomplete="new-password"
                        :rules="data.psw2Rules"
                        color="primary"
                        variant="outlined"
                        density="comfortable"
                        class="mb-6"
                        clearable
                    />

                    <div class="d-flex justify-end gap-2">
                        <v-btn
                            color="primary"
                            variant="tonal"
                            :loading="data.loading"
                            @click="handleEdit"
                        >
                            {{ t('confirm') }}
                        </v-btn>
                        <v-btn
                            color="primary"
                            variant="tonal"
                            @click="handleReset"
                        >
                            {{ t('clear') }}
                        </v-btn>
                    </div>
                </v-form>
            </v-card>
        </v-row>
    </v-container>
</template>

<style scoped></style>
