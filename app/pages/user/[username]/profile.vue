<script setup lang="ts">
    import COS from 'cos-js-sdk-v5'

    const { getCosKey } = useAuth()
    const { updateUser } = useUser()
    const { rules } = useRules()

    const { t } = useLocale()
    const { format } = useDayjs()
    const { show } = useSnakebar()
    const user = useCookie<User>('user')

    const userFormRef = useTemplateRef('userFormRef')
    const userForm = reactive({
        valid: false,
        username: '',
        email: '',
        about: '',
        avatar: '',
        loading: false,
        cosLoading: false,
    })

    onMounted(() => {
        if (user.value) {
            userForm.avatar = user.value.avatar
            userForm.email = user.value.email
            userForm.username = user.value.username
            userForm.about = user.value.about
        }
    })

    const handleUpload = async (file: File | File[]) => {
        if (!file || Array.isArray(file)) return
        try {
            userForm.cosLoading = true
            const { credentials } = await getCosKey()

            const cos = new COS({
                SecretId: credentials.tmpSecretId,
                SecretKey: credentials.tmpSecretKey,
                XCosSecurityToken: credentials.sessionToken,
            })

            cos.putObject({
                Bucket: 'chen-1302611521' /* 存储桶 */,
                Region: 'ap-nanjing' /* 存储桶所在地域，必须字段 */,
                Key: `/blog/avatar/${user.value?.username}/${format(new Date(), 'YYYY-MM-DDTHH:mm:ss')}-${file.name}` /* 文件名 */,
                StorageClass: 'STANDARD', // 上传模式, 标准模式
                Body: file, // 上传文件对象
                onProgress: () => {},
            })
                .then(res => (userForm.avatar = `https://${res.Location}`))
                .catch(err => show(err, 'error'))
        } catch (e) {
        } finally {
            userForm.cosLoading = false
        }
    }

    const handleEdit = async () => {
        if (userFormRef.value) {
            const { valid } = await userFormRef.value.validate()
            if (valid) {
                try {
                    userForm.loading = true
                    await updateUser(user.value.id, {
                        username: userForm.username,
                        about: userForm.about,
                        avatar: userForm.avatar,
                        email: userForm.email,
                    })

                    user.value.username = userForm.username
                    user.value.email = userForm.email
                    user.value.about = userForm.about
                    user.value.avatar = userForm.avatar

                    show('userinfo update', 'success')
                } catch (e) {
                } finally {
                    userForm.loading = false
                }
            }
        }
    }

    const handleResetUserInfo = () => {
        if (userFormRef.value) {
            userFormRef.value.reset()
        }
    }
</script>

<template>
    <v-card class="ma-6" variant="text">
        <v-card-text>
            <v-form ref="userFormRef" v-model="userForm.valid" lazy-validation>
                <v-row>
                    <v-col cols="12" class="text-center">
                        <v-avatar size="100">
                            <v-img
                                sizes="100"
                                alt="avatar"
                                :src="userForm.avatar"
                            >
                            </v-img>
                        </v-avatar>
                    </v-col>
                    <v-col cols="12">
                        <v-file-input
                            accept="image/png, image/jpeg, image/bmp"
                            prepend-icon="mdi-camera"
                            variant="outlined"
                            :label="t('avatar')"
                            :loading="userForm.cosLoading"
                            @update:model-value="handleUpload"
                        ></v-file-input>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field
                            v-model="userForm.username"
                            :label="t('username')"
                            color="primary"
                            variant="outlined"
                            density="comfortable"
                            :rules="rules.nameRules"
                        >
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field
                            v-model="userForm.email"
                            :label="t('email')"
                            color="primary"
                            variant="outlined"
                            density="comfortable"
                            :rules="rules.emailRules"
                        >
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-textarea
                            v-model="userForm.about"
                            :label="t('about')"
                            color="primary"
                            variant="outlined"
                            density="comfortable"
                        >
                        </v-textarea>
                    </v-col>
                    <v-col class="d-flex">
                        <v-btn
                            color="primary"
                            variant="tonal"
                            class="mr-1"
                            :loading="userForm.loading"
                            @click="handleEdit"
                            >{{ t('confirm') }}
                        </v-btn>
                        <v-btn
                            color="primary"
                            variant="tonal"
                            class="mr-1"
                            @click="handleResetUserInfo"
                            >{{ t('clear') }}</v-btn
                        >
                    </v-col>
                </v-row>
            </v-form>
        </v-card-text>
    </v-card>
</template>

<style scoped></style>
