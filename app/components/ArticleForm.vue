<script setup lang="ts">
    import Editor from '@tinymce/tinymce-vue'
    import { joinSpeechText } from '~/composables/useSpeechRecognition'

    const theme = useTheme()
    const { show } = useToast()
    const { fire: fireConfetti } = useConfetti()
    const { t } = useLocale()
    const { rules } = useRules()
    const { upload } = useCosUpload()

    const { createArticle, updateArticle, getArticle } = useArticle()
    const { getTagList } = useTag()

    interface Props {
        mode: 'create' | 'edit'
        id?: string | number
    }

    const { id } = defineProps<Props>()

    useSeoMeta({
        title: computed(() => t(id ? 'edit' : 'add')),
        ogTitle: computed(() => t(id ? 'edit' : 'add')),
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
            // rainy 属暗色系，glass 属亮色系，统一映射到 TinyMCE 两套皮肤
            const val = ['dark', 'rainy'].includes(theme.global.name.value)
                ? 'dark'
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
        // 图片上传：统一走 useCosUpload（临时密钥 + 直传 COS）
        images_upload_handler: async (blobInfo: any) => {
            const file = blobInfo.blob()
            try {
                return await upload(file, {
                    dir: 'blog/article',
                    name: file.name,
                })
            } catch (e: any) {
                show(e?.message ?? String(e), 'error')
                throw e
            }
        },
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
                        fireConfetti(undefined, 140)
                    } else {
                        await createArticle({
                            title: articleForm.title,
                            content: articleForm.content,
                            tag: tags,
                        })
                        show(t('article_create_success'), 'success')
                        fireConfetti(undefined, 160)
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

    // 识别文本按 HTML 文本节点插入：先转义实体，再在英文/数字相接处补空格
    const escapeSpeechHtml = (text: string) =>
        text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const onSpeechResult = (text: string) => {
        const editor = (
            window as unknown as {
                tinymce?: { get: (id: string) => any }
            }
        ).tinymce?.get('tinymce-editor')

        // 编辑器未就绪：退回追加到 content（同样要转义，避免文本被当成标签）
        if (!editor) {
            articleForm.content = joinSpeechText(
                articleForm.content,
                escapeSpeechHtml(text)
            )
            return
        }

        const rng = editor.selection?.getRng?.()
        const node = rng?.startContainer
        const before =
            node?.nodeType === 3
                ? String(node.textContent ?? '').slice(0, rng.startOffset)
                : ''
        const needSpace =
            /[A-Za-z0-9]$/.test(before) && /^[A-Za-z0-9]/.test(text)

        editor.insertContent(`${needSpace ? ' ' : ''}${escapeSpeechHtml(text)}`)
    }
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
        <header class="page-hero anim anim-slide-down">
            <p class="page-hero__eyebrow">✦ Kotae</p>
            <h1 class="text-h4 page-hero__title">
                <span class="k-highlight">{{ id ? t('edit') : t('add') }}</span>
            </h1>
        </header>
        <v-form
            id="articleForm"
            ref="articleFormRef"
            v-model="articleForm.valid"
            class="mb-6"
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
            <div class="d-flex justify-end align-center">
                <SpeechInput @result="onSpeechResult" />
            </div>
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
                    data-cuelume-press
                    data-cuelume-release
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
    </v-container>
</template>

<style scoped></style>
