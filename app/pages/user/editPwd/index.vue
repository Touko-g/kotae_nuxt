<script setup lang="ts">
    definePageMeta({
        middleware: 'auth',
    })
    useSeoMeta({
        title: '修改密码',
        ogTitle: '修改密码',
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
            (v: string) => (!!v && !!v.trim()) || 'Password is required',
        ],
        pswRules: [
            (v: string) => (!!v && !!v.trim()) || 'New Password is required',
            (v: string) =>
                (v && v.length >= 8) ||
                'This password is too short. It must contain at least 8 characters.',
            (v: string) =>
                checkPsw1(v) ||
                'The New Password cannot be the same as the Old Password',
        ],
        psw2Rules: [
            (v: string) =>
                (!!v && !!v.trim()) || 'Confirm Password is required',
            (v: string) => checkPsw(v) || 'Confirm Password does not match',
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
                    <v-btn color="primary" variant="tonal" @click="handleReset">
                        {{ t('clear') }}
                    </v-btn>
                </div>
            </v-form>
        </v-card>
    </v-row>
</template>

<style scoped></style>
