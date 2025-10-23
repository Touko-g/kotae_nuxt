<script setup lang="ts">
    import COS from 'cos-js-sdk-v5'
    import Editor from '@tinymce/tinymce-vue'

    const theme = useTheme()
    const { format } = useDayjs()
    const { show } = useSnakebar()
    const { t } = useLocale()
    const { rules } = useRules()

    const { getCosKey } = useAuth()
    const { getArticle, createArticle, updateArticle } = useArticle()
    const { getTagList } = useTag()

    interface Props {
        mode: 'create' | 'edit'
        id?: string | number
    }

    const { id } = defineProps<Props>()

    useSeoMeta({
        title: id ? '修改文章' : '创建文章',
        ogTitle: id ? '修改文章' : '创建文章',
    })

    const articleFormRef = useTemplateRef('articleFormRef')
    const articleForm = reactive({
        valid: false,
        title: '',
        content: '',
        select: [] as string[],
        items: [] as string[],
        searchLoading: false,
        loading: false,
    })

    const editorLoad = ref(true)
    const editorConfig = reactive({
        skin_url: computed(() => {
            const val = ['light', 'dark'].includes(theme.global.name.value)
                ? theme.global.name.value
                : 'light'
            return `https://chen-1302611521.cos.ap-nanjing.myqcloud.com/tinymce/${val}/skins/ui/${val}`
        }),
        plugins:
            'link lists image codesample code table wordcount  table fullscreen preview pagebreak insertdatetime', // 插件
        toolbar:
            'codesample image bold italic underline alignleft aligncenter alignright alignjustify | forecolor backcolor | fontselect | fontsizeselect | formatselect |  bullist numlist | outdent indent blockquote | removeformat| undo redo | link unlink media insertdatetime table  hr pagebreak | fullscreen preview | strikethrough', // 工具条
        font_formats:
            'Arial=arial,helvetica,sans-serif; 宋体=SimSun;  微软雅黑=Microsoft Yahei; Impact=impact,chicago;', // 字体
        fontsize_formats: '11px 12px 14px 16px 18px 24px 36px 48px 64px 72px', // 文字大小
        paste_data_images: true,
        codesample_languages: [
            { text: 'HTML/XML', value: 'markup' },
            { text: 'JavaScript', value: 'javascript' },
            { text: 'TypeScript', value: 'typescript' },
            { text: 'CSS', value: 'css' },
            { text: 'Java', value: 'java' },
            { text: 'C++', value: 'cpp' },
            { text: 'Python', value: 'python' },
        ],
        branding: false,
        // 图片上传回调
        images_upload_handler: (blobInfo: any) =>
            new Promise((resolve, reject) => {
                const file = blobInfo.blob()
                getCosKey()
                    .then(res => {
                        const cos = new COS({
                            SecretId: res.credentials.tmpSecretId, // 身份识别ID
                            SecretKey: res.credentials.tmpSecretKey, // 身份秘钥
                            XCosSecurityToken: res.credentials.sessionToken,
                        })
                        cos.putObject(
                            {
                                Bucket: 'chen-1302611521' /* 存储桶 */,
                                Region: 'ap-nanjing' /* 存储桶所在地域，必须字段 */,
                                Key: `/blog/article/${format(new Date(), 'YYYY-MM-DDTHH:mm:ss')}-${file.name}` /* 文件名 */,
                                StorageClass: 'STANDARD', // 上传模式, 标准模式
                                Body: file, // 上传文件对象
                            },
                            (err, data) => {
                                // 上传成功之后
                                if (data.statusCode === 200) {
                                    const path = `https://${data.Location}`
                                    resolve(path)
                                }
                                if (err) {
                                    show(err.message, 'error')
                                    reject(err)
                                }
                            }
                        )
                    })
                    .catch(e => {
                        reject(e)
                    })
            }),
    })

    onMounted(async () => {
        const form = document.getElementById('articleForm') as HTMLElement
        const observer = new MutationObserver(mutations => {
            if (mutations.length) {
                editorLoad.value = false
            }
        })
        observer.observe(form, { childList: true })

        if (id) {
            const { title, content, tag } = await getArticle(id)
            articleForm.title = title
            articleForm.content = content
            articleForm.select = tag.map(i => i.name)
        }
    })

    const getTag = async (e: string) => {
        try {
            articleForm.searchLoading = true
            const { results } = await getTagList({ name: e })
            if (results && results.length > 0) {
                articleForm.items = results.map(tag => tag.name)
            }
        } catch (e) {
        } finally {
            articleForm.searchLoading = false
        }
    }

    const publish = async () => {
        if (articleFormRef.value) {
            const { valid } = await articleFormRef.value.validate()
            if (valid) {
                const tags = articleForm.select.map(tag => ({ name: tag }))
                try {
                    articleForm.loading = true
                    if (id) {
                        await updateArticle(id, {
                            title: articleForm.title,
                            content: articleForm.content,
                            tag: tags,
                        })
                        show(t('article_edit_success'), 'success')
                    } else {
                        await createArticle({
                            title: articleForm.title,
                            content: articleForm.content,
                            tag: tags,
                        })
                        show(t('article_create_success'), 'success')
                    }
                    reset()
                } catch (err) {
                } finally {
                    articleForm.loading = false
                }
            }
        }
    }

    const reset = () => {
        if (articleFormRef.value) {
            articleFormRef.value.reset()
        }
    }
</script>

<template>
    <p class="my-6 text-2xl text-uppercase d-flex align-center justify-center">
        <v-icon
            :icon="id ? 'mdi-circle-edit-outline' : 'mdi-circle-edit-outline'"
            class="mr-3"
        ></v-icon>
        {{ id ? t('edit') : t('add') }}
    </p>
    <v-divider color="surface" />
    <v-form
        id="articleForm"
        ref="articleFormRef"
        v-model="articleForm.valid"
        class="mb-6 mx-6"
        lazy-validation
    >
        <v-text-field
            v-model="articleForm.title"
            :label="t('title')"
            color="primary"
            variant="outlined"
            density="comfortable"
            :rules="rules.titleRules"
        ></v-text-field>
        <Editor
            id="tinymce-editor"
            v-model="articleForm.content"
            :init="editorConfig"
            api-key="4aoi5vbw5t6v7q43jt2w6s6q9cpzikf3384bpre1tq2pftid"
        />
        <v-overlay
            v-model="editorLoad"
            color="primary"
            class="d-flex justify-center align-center"
            persistent
        >
            <div class="w-[120px]">
                <v-progress-linear
                    color="info"
                    indeterminate
                    rounded
                    height="10"
                ></v-progress-linear>
            </div>
        </v-overlay>
        <v-combobox
            v-model="articleForm.select"
            class="my-10"
            variant="outlined"
            color="primary"
            density="comfortable"
            :items="articleForm.items"
            :label="t('tag')"
            multiple
            chips
            :rules="rules.tagRules"
            :loading="articleForm.searchLoading"
            @update:search="getTag"
        ></v-combobox>
        <p class="d-flex">
            <v-btn
                color="primary"
                variant="tonal"
                :loading="articleForm.loading"
                @click="publish"
                >{{ t(id ? 'edit' : 'publish') }}</v-btn
            >
            <v-btn
                color="primary"
                variant="tonal"
                class="ml-1"
                @click="reset"
                >{{ t('reset') }}</v-btn
            >
        </p>
    </v-form>
</template>

<style scoped></style>
