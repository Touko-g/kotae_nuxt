<script setup lang="ts">
    import Editor from '@tinymce/tinymce-vue'
    import type { AiAssistAction } from '#shared/types/ai'
    import { escapeHtml, normalizeAiHtml } from '~/composables/useAiHtml'
    import {
        joinSpeechText,
        useSpeechRecognition,
    } from '~/composables/useSpeechRecognition'

    const theme = useTheme()
    const { show } = useToast()
    const { fire: fireConfetti } = useConfetti()
    const { t, current } = useLocale()
    const { rules } = useRules()
    const { upload } = useCosUpload()
    const { extractText } = useExtractText()
    const runtimeConfig = useRuntimeConfig()

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

    /**
     * 工具栏自定义图标。TinyMCE 自带图标集里没有「魔法棒」和「麦克风」，
     * 用 ui.registry.addIcon 注册 MDI 的 path。
     * 注意 addIcon 收的是**完整 SVG 字符串**，只给 path 渲染不出来；
     * fill 用 currentColor，这样亮/暗皮肤下颜色自动跟随。
     */
    const TOOLBAR_ICONS = {
        ai: 'M7.5 5.6 10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7l2.5-1.4m12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14l-2.5 1.4M22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2m-8.66 10.78 2.44-2.44-2.12-2.12-2.44 2.44 2.12 2.12m1.03-5.49 2.34 2.34c.39.37.39 1.02 0 1.41L5.04 22.71c-.39.39-1.04.39-1.41 0l-2.34-2.34a.996.996 0 0 1 0-1.41L12.96 7.29c.37-.39 1.02-.39 1.41 0Z',
        mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3m5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z',
    }

    const toolbarIcon = (path: string) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="${path}"/></svg>`

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
        // 末尾两个是自定义按钮：AI 写作下拉 + 语音输入，注册逻辑见下方 setup
        toolbar: computed(
            () =>
                'codesample image bold italic underline alignleft aligncenter alignright alignjustify | forecolor backcolor | fontselect | fontsizeselect | formatselect |  bullist numlist | outdent indent blockquote | removeformat| undo redo | link unlink media insertdatetime table  hr pagebreak | fullscreen preview | strikethrough' +
                (aiAvailable.value ? ' | kAiWriter' : '') +
                ' | kSpeech'
        ),
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
        /**
         * 工具栏里的「AI 写作 / 语音输入」。
         *
         * 用 TinyMCE 自己的 ui.registry 注册成原生按钮：宽度、换行、皮肤、
         * 悬停高亮全都由编辑器接管，不会再像之前那样在标题和正文之间
         * 单独占一行、和 toolbar 各说各话。
         */
        setup: (editor: any) => {
            editor.ui.registry.addIcon('kAi', toolbarIcon(TOOLBAR_ICONS.ai))
            editor.ui.registry.addIcon('kMic', toolbarIcon(TOOLBAR_ICONS.mic))

            // 没配密钥就不注册，toolbar 里写着的 kAiWriter 会被 TinyMCE 忽略
            if (aiAvailable.value) {
                // AI 写作：菜单项直接由 AI_MENU 生成，每次展开都取最新的 i18n 文案
                editor.ui.registry.addMenuButton('kAiWriter', {
                    icon: 'kAi',
                    tooltip: t('ai_assist'),
                    fetch: (callback: any) =>
                        callback(
                            aiMenu.value.map(item => ({
                                type: 'menuitem',
                                text: item.text,
                                onAction: () => openAi(item.key),
                            }))
                        ),
                })
            }

            // 语音输入：录音中把按钮点亮，实时转写浮条由 <SpeechLiveBar> 显示
            // 必须用 addToggleButton —— 普通 addButton 的 api 没有 setActive
            editor.ui.registry.addToggleButton('kSpeech', {
                icon: 'kMic',
                tooltip: t('speech_input'),
                onSetup: (api: any) => {
                    if (!speechSupported.value) {
                        api.setEnabled(false)
                        return () => {}
                    }
                    return watch(listening, value => api.setActive(value), {
                        immediate: true,
                    })
                },
                onAction: () => toggleSpeech(),
            })
        },
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
    // （escapeHtml 来自 useAiHtml，AI 插入正文时复用同一套转义）
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
                escapeHtml(text)
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

        editor.insertContent(`${needSpace ? ' ' : ''}${escapeHtml(text)}`)
    }

    /**
     * 工具栏里的语音按钮用它，和 <SpeechInput> 内部是同一套识别逻辑。
     * 识别结果仍旧走 onSpeechResult 插到光标处，实时转写浮条由 <SpeechLiveBar> 负责。
     */
    const speechLang = computed(() =>
        current.value === 'zh' ? 'zh-CN' : 'en-US'
    )
    const {
        supported: speechSupported,
        listening,
        interim,
        toggle: toggleSpeech,
    } = useSpeechRecognition({
        lang: speechLang,
        onFinal: onSpeechResult,
        onError: key => show(t(key), 'error'),
    })

    // ---------------- AI 写作助手 ----------------

    /** 提示词里携带的原文上限，避免超长文章把上下文撑爆 */
    const AI_CONTEXT_LIMIT = 1600

    const aiAvailable = computed(() => runtimeConfig.public.aiEnabled !== false)
    const aiOpen = ref(false)
    const aiAction = ref('polish')
    const aiSource = ref('')
    const aiActions = ref<AiAssistAction[]>([])
    /** 打开面板时保存的选区书签：面板获得焦点后编辑器选区会丢，应用时靠它复位 */
    let aiBookmark: unknown = null

    const getEditor = () =>
        (
            window as unknown as {
                tinymce?: { get: (id: string) => any }
            }
        ).tinymce?.get('tinymce-editor')

    /** 选区 HTML：改写类动作要连标签一起交给模型，才能保住标题/列表/加粗这些排版 */
    const getSelectionHtml = () =>
        String(
            getEditor()?.selection?.getContent?.({ format: 'html' }) ?? ''
        ).trim()

    const getBodyText = () => extractText(articleForm.content || '').trim()

    /** 富文本动作的公共约束：只回 HTML 片段，别套 Markdown 围栏 */
    const HTML_RULE_BASE =
        '只输出 HTML 片段（可用 <p> <h2> <h3> <h4> <ul> <ol> <li> <strong> <em> <blockquote> <pre> <code>），' +
        '不要用 Markdown 代码块包裹，不要输出 <html>/<body>，不要任何解释。' +
        '代码一律写成 <pre class="language-xxx"><code>代码</code></pre>，xxx 取 javascript / typescript / html / css / json / python / java / c，' +
        '其它语言照实写；行内代码用 <code>。不要用 ``` 围栏，也不要把代码丢成纯文本段落。'

    /** 默认不许模型自作主张上色，但原文已有的样式要保住 */
    const COLOR_RULE_OFF =
        '不要自己新增颜色、背景色或自定义样式；原文里已有的内联样式（如 <span style="color:…">）请原样保留。'

    /**
     * 「标重点」专用强调色：取站点浅色主题的主色，和正文里的链接/主按钮同一支红，
     * 在深色卡片上（#1E1E1E）对比度约 3.7:1，仍能看清。改这里就能换整站标重点的颜色。
     */
    const HIGHLIGHT_COLOR = '#e41b23'

    /** 只有标重点类动作放开颜色，其余动作继续走 COLOR_RULE_OFF */
    const COLOR_RULE_ON =
        `允许给关键语句套 <span style="color:${HIGHLIGHT_COLOR}"> 上色，也可以再套 <strong> 加粗；` +
        '除此之外不要新增任何样式（不要改字号、字体、背景色、对齐）。原文已有的内联样式请原样保留。'

    const HTML_RULE = HTML_RULE_BASE + COLOR_RULE_OFF

    const AI_MENU = [
        {
            key: 'polish',
            label: 'ai_polish',
            icon: 'mdi-auto-fix',
            format: 'html',
        },
        {
            key: 'expand',
            label: 'ai_expand',
            icon: 'mdi-arrow-expand-horizontal',
            format: 'html',
        },
        {
            key: 'shorten',
            label: 'ai_shorten',
            icon: 'mdi-arrow-collapse-horizontal',
            format: 'html',
        },
        {
            key: 'highlight',
            label: 'ai_highlight',
            icon: 'mdi-format-color-highlight',
            format: 'html',
        },
        {
            key: 'continue',
            label: 'ai_continue',
            icon: 'mdi-text-box-plus-outline',
            format: 'html',
        },
        {
            key: 'title',
            label: 'ai_title',
            icon: 'mdi-format-title',
            format: 'text',
        },
        {
            key: 'translate_en',
            label: 'ai_translate_en',
            icon: 'mdi-translate',
            format: 'html',
        },
        {
            key: 'translate_zh',
            label: 'ai_translate_zh',
            icon: 'mdi-translate',
            format: 'html',
        },
    ] as const

    /** 需要选区的动作：没有选中文字时不该让它们作用于全文 */
    const SELECTION_ACTIONS = [
        'polish',
        'expand',
        'shorten',
        'highlight',
        'translate_en',
        'translate_zh',
    ]

    const aiMenu = computed(() =>
        AI_MENU.map(item => ({ ...item, text: t(item.label) }))
    )

    const aiPrompt = (key: string, text: string) => {
        switch (key) {
            case 'polish':
                return `请润色下面这段富文本：保持原意、原语言和原有的标签结构（段落、标题层级、列表、加粗、链接一律保留，不要新增或删除结构），修正语病、重复和生硬的表达，让行文更自然。${HTML_RULE}\n\n${text}`
            case 'expand':
                return `请扩写下面这段富文本：保持原意和语言不变，补充细节、例子或过渡，篇幅约为原文的两倍；可以新增段落或列表项，但不要改变原有的标题层级，不要编造具体数据、版本号或事实。${HTML_RULE}\n\n${text}`
            case 'shorten':
                return `请精简下面这段富文本：保留关键信息与逻辑，删掉冗余和重复，篇幅压到原文的一半左右；保持原有标签结构。${HTML_RULE}\n\n${text}`
            case 'highlight':
                return `请给下面这段富文本标出重点：通读一遍，挑出 1 到 3 处最关键的语句、结论或数字（宁少勿多，最多 3 处），用 <span style="color:${HIGHLIGHT_COLOR}"> 把它们包起来；其中最重要的一处可以再套 <strong>。除此之外一个字都不要改：不要改写措辞、不要增删句子、不要调整段落顺序与标题层级，只加标记。如果原文某些语句本来就已经有颜色，保持原样不要动。${HTML_RULE_BASE}${COLOR_RULE_ON}\n\n${text}`
            case 'continue':
                return `请顺着下面这段文字继续写 2 到 3 段，语气、人称和行文风格与上文保持一致；用 <p> 分段，必要时用 <h2>/<h3> 小标题或 <ul><li> 列表。只输出新增的内容，不要重复原文，不要编造上文没有出现过的具体数据、版本号或事实。${HTML_RULE}\n\n${text}`
            case 'title':
                return `根据下面的文章内容起 5 个标题，语言与正文一致，具体、有信息量、不夸张。每行一个标题，不要编号、不要引号、不要解释。\n\n${text}`
            case 'translate_en':
                return `请把下面的富文本翻译成英文，保持原有 HTML 标签结构、段落与标题层级，语气和专业术语照旧。${HTML_RULE}\n\n${text}`
            case 'translate_zh':
                return `请把下面的富文本翻译成简体中文，保持原有 HTML 标签结构、段落与标题层级，语气和专业术语照旧。${HTML_RULE}\n\n${text}`
            default:
                return text
        }
    }

    /** 有选区时给全套动作，没选区时只给「续写 / 起标题」这类不破坏原文的 */
    const buildAiActions = (
        selectionHtml: string,
        body: string
    ): AiAssistAction[] => {
        const keys = selectionHtml
            ? [...SELECTION_ACTIONS, 'continue', 'title']
            : ['continue', 'title']

        return keys.map(key => {
            const item = aiMenu.value.find(menu => menu.key === key)
            const usesSelection =
                selectionHtml && SELECTION_ACTIONS.includes(key)
            const text = usesSelection
                ? selectionHtml
                : key === 'continue'
                  ? body.slice(-AI_CONTEXT_LIMIT)
                  : body.slice(0, AI_CONTEXT_LIMIT)

            return {
                key,
                label: item?.text ?? key,
                icon: item?.icon ?? 'mdi-auto-fix',
                format: item?.format ?? 'text',
                prompt: aiPrompt(key, text),
            }
        })
    }

    const openAi = (key: string) => {
        const selectionHtml = getSelectionHtml()
        const selectionText = extractText(selectionHtml).trim()
        const body = getBodyText()

        if (SELECTION_ACTIONS.includes(key) && !selectionText) {
            show(t('ai_need_selection'), 'warning')
            return
        }
        if (!body) {
            show(t('ai_need_content'), 'warning')
            return
        }

        aiBookmark = getEditor()?.selection?.getBookmark?.(2, true) ?? null
        aiAction.value = key
        aiActions.value = buildAiActions(selectionHtml, body)
        // 面板里的原文预览用纯文本，避免满屏标签
        aiSource.value = SELECTION_ACTIONS.includes(key)
            ? selectionText
            : key === 'continue'
              ? body.slice(-AI_CONTEXT_LIMIT)
              : body.slice(0, AI_CONTEXT_LIMIT)
        aiOpen.value = true
    }

    const applyAi = (result: string, key: string) => {
        const text = result.trim()
        if (!text) return

        // 标题：取第一行，去掉可能残留的序号（纯文本动作，不走 HTML 管线）
        if (key === 'title') {
            const first =
                text
                    .split('\n')
                    .map(line => line.trim())
                    .filter(Boolean)[0] ?? ''
            articleForm.title = first.replace(/^[\d.、)．\s-]+/, '')
            show(t('ai_title_applied'), 'success')
            return
        }

        // 富文本：去围栏 → 兜底纯文本转段落 → DOMPurify 净化，再进编辑器
        const html = normalizeAiHtml(text)
        if (!html) return

        const editor = getEditor()
        if (!editor) {
            articleForm.content += html
            return
        }

        editor.focus()
        if (aiBookmark) editor.selection.moveToBookmark(aiBookmark)
        // 统一用 insertContent：有选区时它替换选区，无选区时插到光标处；
        // 实测 selection.setContent 在多块选区上会多留一个空 <p>
        editor.insertContent(html)
        // 主动回写 v-model：编辑器内容变了但模型没跟上时，包装组件可能用旧值把正文冲掉
        articleForm.content = editor.getContent()
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
            <!--
                按钮本体已经注册进 TinyMCE 工具栏（见 editorConfig.setup），
                这里只留实时转写浮条：它 Teleport 到 body，不占布局位置。
            -->
            <SpeechLiveBar :listening="listening" :interim="interim" />
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

        <AiAssistDialog
            v-model="aiOpen"
            :actions="aiActions"
            :initial-key="aiAction"
            :source-text="aiSource"
            :max-tokens="1800"
            @apply="applyAi"
        />
    </v-container>
</template>

<style scoped></style>
