<script setup lang="ts">
    import EmojiPicker from 'vue3-emoji-picker'
    import 'vue3-emoji-picker/css'
    import type {
        AiAssistAction,
        AiBuiltinAction,
        AiPromptVarName,
        AiPromptVars,
    } from '#shared/types/ai'
    import { renderAiPrompt, useAiPrompts } from '~/composables/useAiPrompts'
    import { joinSpeechText } from '~/composables/useSpeechRecognition'
    interface Props {
        article: number
        /** 文章标题：AI 生成评论时作为上下文 */
        title?: string
        /**
         * 文章正文摘要（纯文本，已截断）。
         * 「帮我写一条」靠它才知道文章讲了什么 —— 只给标题的话模型只能瞎猜。
         */
        excerpt?: string
    }
    const { article, title, excerpt } = defineProps<Props>()
    const { getCommentList, postComment } = useComment()
    const { formatNow } = useDayjs()
    const { t } = useLocale()
    const { mobile } = useDisplay()
    const { show } = useToast()
    const runtimeConfig = useRuntimeConfig()
    const isLogin = useState('isLogin')

    const comment = ref('')
    const comments = ref<CommentListResponse | null>(null)
    const commentListRef = useTemplateRef('commentListRef')
    const commentLoading = ref(false)
    const replyLoading = ref(false)

    const search = reactive({
        page: 1,
        pageSize: 10,
        count: 0,
        order: 'create_time',
    })

    const emojiDialog = ref(false)
    const replyDialog = ref(false)

    const data = reactive({
        dialog: false,
        reply_info: {
            reply: 0,
            reply_user: '',
            content: '',
            replyIndex: 0,
            isReply: false,
            /** 被回复的那条评论正文：AI 写回复时靠它才知道在回谁、回什么 */
            reply_content: '',
        },
        flag_id: 0,
    })

    const getComments = async (params: CommentListParams) => {
        const res = await getCommentList({ article, ...params })
        comments.value = res
        search.count = Math.ceil(res.count / 10)
        return res
    }

    const onSelectEmoji = (emoji: any) => {
        if (replyDialog.value) {
            data.reply_info.content += emoji.i
        } else comment.value += emoji.i
    }

    const onSpeechResult = (text: string) => {
        if (replyDialog.value) {
            data.reply_info.content = joinSpeechText(
                data.reply_info.content,
                text
            )
        } else comment.value = joinSpeechText(comment.value, text)
    }

    // ---------------- AI 评论助手 ----------------

    const aiAvailable = computed(() => runtimeConfig.public.aiEnabled !== false)
    const aiOpen = ref(false)
    const aiAction = ref('polish')
    const aiSource = ref('')
    const aiActions = ref<AiAssistAction[]>([])
    /** 结果写回哪个输入框 */
    const aiTarget = ref<'comment' | 'reply'>('comment')
    /** 打开面板时的草稿文本：提示词改完后要靠它重建 actions */
    let aiLastText = ''

    const { resolveBuiltin, customActions } = useAiPrompts()

    /**
     * 每个动作运行时**真的有值**的占位符，配置面板据此只列能用的 chip。
     *
     * 改写类：草稿 + 标题 + 正文摘要（想让它参考全文时可以引用）
     * 生成类：没有草稿，只有标题 + 正文
     * 回复：在生成类基础上多一个「对方说了什么」
     */
    const REWRITE_VARS: AiPromptVarName[] = ['text', 'title', 'article']
    const GENERATE_VARS: AiPromptVarName[] = ['title', 'article']
    const REPLY_VARS: AiPromptVarName[] = ['title', 'article', 'reply']
    /**
     * 自定义动作的占位符全集：自定义动作不知道用户想干嘛，只能给场景级的全集。
     * `{{reply}}` 只在回复框里真有值，但用户写自定义动作时确实可能想要它。
     */
    const CUSTOM_VARS: AiPromptVarName[] = ['text', 'title', 'article', 'reply']

    /**
     * 内置动作。
     *
     * 「帮我写一条」和「帮我回一条」是**两个动作**，不是一个动作两套文案 ——
     * 它们的提示词本来就不一样（一个是对文章发表看法，一个要接住对方的话）。
     * 早先共用一个 `generate` key，配置面板里只能显示其中一个，在回复框点过 AI
     * 之后列表里就只剩「帮我回一条」，「帮我写一条」像是消失了。
     */
    const AI_MENU = [
        {
            key: 'polish',
            label: 'ai_polish',
            icon: 'mdi-auto-fix',
            target: 'both',
            vars: REWRITE_VARS,
        },
        {
            key: 'shorten',
            label: 'ai_shorten',
            icon: 'mdi-arrow-collapse-horizontal',
            target: 'both',
            vars: REWRITE_VARS,
        },
        {
            key: 'friendly',
            label: 'ai_friendly',
            icon: 'mdi-emoticon-happy-outline',
            target: 'both',
            vars: REWRITE_VARS,
        },
        {
            key: 'translate_en',
            label: 'ai_translate_en',
            icon: 'mdi-translate',
            target: 'both',
            vars: REWRITE_VARS,
        },
        {
            key: 'translate_zh',
            label: 'ai_translate_zh',
            icon: 'mdi-translate',
            target: 'both',
            vars: REWRITE_VARS,
        },
        {
            key: 'generate_comment',
            label: 'ai_generate_comment',
            icon: 'mdi-comment-plus-outline',
            target: 'comment',
            vars: GENERATE_VARS,
        },
        {
            key: 'generate_reply',
            label: 'ai_generate_reply',
            icon: 'mdi-comment-quote-outline',
            target: 'reply',
            vars: REPLY_VARS,
        },
    ] as const

    type AiTarget = 'comment' | 'reply'

    /** 当前场景该出现哪些动作：改写类两边都要，生成类各归各的 */
    const aiMenuFor = (target: AiTarget) =>
        AI_MENU.filter(
            item => item.target === 'both' || item.target === target
        ).map(item => ({ ...item, text: t(item.label) }))

    /** 某个场景对应的「帮我写一条 / 帮我回一条」 */
    const generateKey = (target: AiTarget) =>
        target === 'reply' ? 'generate_reply' : 'generate_comment'

    const aiMenu = computed(() => aiMenuFor('comment'))
    const aiMenuReply = computed(() => aiMenuFor('reply'))

    /** 回复场景的上下文：对方是谁、说了什么。没有它就只是在凭空写评论 */
    const replyContext = () =>
        data.reply_info.reply_content
            ? `你正在回复 ${data.reply_info.reply_user} 的评论，对方说：「${data.reply_info.reply_content}」。`
            : `你正在回复 ${data.reply_info.reply_user} 的评论。`

    /**
     * 人味约束：模型默认会写成「客服腔 + 总结体」（先复述观点再来一句不痛不痒的评价）。
     * 这里明说要像真人随手留言，并允许适度用 emoji —— 表情是最省力的「像人」信号，
     * 但不能堆，一多就变成营销号。
     */
    const HUMAN_RULE =
        '像一个真实读者刷完文章随手留的一句话，不要像 AI 助手或客服：' +
        '有具体观点或情绪，可以吐槽、提问、自嘲，允许「哈哈」「啊」「吧」这类语气词；' +
        '可以用 1 到 2 个 emoji，但别堆。' +
        '不要总结文章、不要四字词堆砌、不要「总的来说」这种书面腔、不要空泛客套。'

    /** 生成类动作：它们是「另写一条」，不是改写现有文字 */
    const isGenerate = (key: string) => key.startsWith('generate')

    /**
     * 内置动作的提示词模板。
     *
     * 改写类统一说「这段文字」而不是「这条评论 / 这条回复」：配置面板里每个动作
     * 只有一份配置，两个场景共用，文案必须中立。
     * 「帮我回一条」用 `{{reply}}` 占位 —— 对方说了什么要到运行时才知道，
     * 写死在模板里会让每条回复都带着同一条旧评论。
     */
    const promptTemplate = (key: string) => {
        switch (key) {
            case 'polish':
                return `请润色下面这段文字：保持原意和语言不变，改掉语病、重复和啰嗦的地方，读起来更自然口语化。只输出正文，不要解释。\n\n{{text}}`
            case 'shorten':
                return `请把下面这段文字精简到 30 字以内，保留核心意思和原本语气。只输出正文，不要解释。\n\n{{text}}`
            case 'friendly':
                return `请把下面这段文字改写得更热情友善一些，保持原意，不要夸张也不要谄媚，可以加一个 emoji（也可以不加）。只输出正文，不要解释。\n\n{{text}}`
            case 'translate_en':
                return `请把下面这段文字翻译成英文，保持口语化的语气。只输出译文，不要解释。\n\n{{text}}`
            case 'translate_zh':
                return `请把下面这段文字翻译成简体中文，保持口语化的语气。只输出译文，不要解释。\n\n{{text}}`
            case 'generate_comment':
                return `请针对下面这篇文章写一条 20 到 40 字的中文评论。${HUMAN_RULE}可以提到文章里的某个点。只输出评论正文。\n\n《{{title}}》\n{{article}}`
            case 'generate_reply':
                return `请针对下面这篇文章下的一条评论写一条回复。{{reply}}要求：20 到 40 字，接住对方说的具体内容（同意、补充、解释、反驳或反问都行）。${HUMAN_RULE}不要重复对方的原话。只输出回复正文。\n\n《{{title}}》\n{{article}}`
            default:
                return '{{text}}'
        }
    }

    /**
     * 变量取值。每个占位符只对应一种东西，不随动作变：
     *
     * - `{{text}}`    输入框里的草稿（生成类动作没有输入，就是空）
     * - `{{article}}` 文章正文摘要
     *
     * 曾经让生成类的 `{{text}}` 退化成正文，结果和 `{{article}}` 撞在同一个值上 ——
     * 两个名字指向一样的东西，用户没法判断该用哪个。
     */
    const promptVars = (key: string, draft: string): AiPromptVars => ({
        text: isGenerate(key) ? '' : draft,
        title: title ?? '',
        reply: key === 'generate_reply' ? replyContext() : '',
        article: excerpt ?? '',
    })

    /** 渲染内置默认提示词 */
    const defaultPrompt = (key: string, text: string) =>
        renderAiPrompt(promptTemplate(key), promptVars(key, text), 'text')

    /**
     * 最终提示词：用户覆盖过就用覆盖的模板，否则用内置默认。
     * 评论场景一律按纯文本渲染 —— 输入框不接 HTML，给富文本约束反而是干扰。
     */
    const aiPrompt = (key: string, text: string) =>
        resolveBuiltin(
            'comment',
            key,
            defaultPrompt(key, text),
            promptVars(key, text),
            'text'
        )

    const buildAiActions = (
        text: string,
        target: 'comment' | 'reply'
    ): AiAssistAction[] => {
        const keys = text
            ? [
                  'polish',
                  'shorten',
                  'friendly',
                  'translate_en',
                  'translate_zh',
                  generateKey(target),
              ]
            : [generateKey(target)]

        const builtin = keys.map(key => {
            const item = aiMenuFor(target).find(menu => menu.key === key)
            return {
                key,
                label: item?.text ?? key,
                icon: item?.icon ?? 'mdi-auto-fix',
                prompt: aiPrompt(key, text),
            }
        })

        return [
            ...builtin,
            ...customActions('comment', {
                text,
                title: title ?? '',
                reply: target === 'reply' ? replyContext() : '',
                article: excerpt ?? '',
            }),
        ]
    }

    /** 传给提示词配置面板的内置动作清单（面板只认 label，不认 i18n key） */
    const aiBuiltins = computed<AiBuiltinAction[]>(() =>
        // 刻意不按当前场景过滤：配置面板要能看到全部动作。
        // 早先跟着 aiTarget 走，在回复框点过 AI 之后，「帮我写一条」就从列表里消失了
        AI_MENU.map(item => ({
            key: item.key,
            label: t(item.label),
            icon: item.icon,
            format: 'text' as const,
            defaultTemplate: promptTemplate(item.key),
            // 面板据此只显示这个动作真的能填上的占位符
            vars: [...item.vars],
        }))
    )

    /**
     * 提示词改过了：用缓存的草稿重建 actions，让面板里的 prompt 立刻是新值。
     * 不自动重跑 —— 用户只是改了配置，不该顺手烧掉一次额度。
     */
    const onPromptsChanged = () => {
        aiActions.value = buildAiActions(aiLastText, aiTarget.value)
    }

    const openAi = (target: 'comment' | 'reply', key: string) => {
        const text = (
            target === 'reply' ? data.reply_info.content : comment.value
        ).trim()

        if (!isGenerate(key) && !text) {
            show(t('ai_need_content'), 'warning')
            return
        }

        aiTarget.value = target
        aiLastText = text
        aiAction.value = key
        aiActions.value = buildAiActions(text, target)
        // 生成类动作没有原文可看：回复时展示被回复的那条评论，评论文章时展示标题
        aiSource.value = isGenerate(key)
            ? target === 'reply'
                ? data.reply_info.reply_content
                : (title ?? '')
            : text
        aiOpen.value = true
    }

    const applyAi = (result: string) => {
        const text = result.trim()
        if (!text) return
        if (aiTarget.value === 'reply') data.reply_info.content = text
        else comment.value = text
    }

    const handlePostComment = async () => {
        if (!isLogin.value) return

        if (comment.value.length) {
            try {
                commentLoading.value = true
                const data = await postComment({
                    article,
                    content: comment.value,
                })
                comment.value = ''

                if (search.order === 'create_time') {
                    if (comments.value) {
                        if (comments.value.results.length < 10) {
                            comments.value.results.push(data)
                            // 滚动到末尾
                            commentListRef.value?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'end',
                                inline: 'nearest',
                            })
                        }
                    }
                } else {
                    comments.value?.results.unshift(data)
                }

                show(t('comment_success'), 'success')
            } catch (e) {
            } finally {
                commentLoading.value = false
            }
        }
    }

    /** 空内容不发：按钮直接灰掉，比点了没反应清楚 */
    const canPost = computed(() => !!comment.value.trim())

    /**
     * 评论框回车提交。
     *
     * 两条必须让路：
     * - Shift + Enter 是换行（多行评论总得能换行）
     * - 输入法组词中的回车是在选字，不能当提交 —— 否则打「nihao」按回车选词，
     *   半截话就发出去了。Chrome 组词时 keyCode 是 229，Safari 只给 isComposing。
     */
    const onCommentEnter = (e: KeyboardEvent) => {
        if (e.shiftKey || e.isComposing || e.keyCode === 229) return
        e.preventDefault()
        handlePostComment()
    }

    const byTime = () => {
        search.order === 'create_time'
            ? (search.order = '-create_time')
            : (search.order = 'create_time')
        getComments(search)
    }

    const viewMore = (id: number) => {
        data.flag_id = id
    }

    const changePage = (page: number) => {
        search.page = page
        getComments(search)
    }

    /**
     * 打开回复对话框
     * @param reply 回复信息
     * @param index 当前回复信息所处 comments 列表下标，用于插入回复信息
     * @param isReply 是否二次回复
     */
    const handleOpen = (
        reply: ReplyComment | BaseComment,
        index: number,
        isReply: boolean
    ) => {
        data.reply_info.reply = reply.id
        data.reply_info.reply_user = reply.user_info.username
        data.reply_info.replyIndex = index
        data.reply_info.isReply = isReply
        // 存下对方原话，AI 写回复时要靠它
        data.reply_info.reply_content = reply.content ?? ''
        replyDialog.value = true
    }

    /**
     * 重置回复弹窗
     */
    const handleReset = () => {
        replyDialog.value = false
        data.reply_info.content = ''
        data.reply_info.reply_content = ''
        replyLoading.value = false
    }

    const handleReply = async () => {
        if (data.reply_info.content.length) {
            try {
                replyLoading.value = true
                const res = await postComment({
                    article,
                    content: data.reply_info.content,
                    reply: data.reply_info.reply,
                })

                replyDialog.value = false

                // 二次回复设置回复人
                if (data.reply_info.isReply) {
                    res.reply_user = data.reply_info.reply_user
                }
                // 插入至对应评论位置,减少网络请求
                comments.value?.results[
                    data.reply_info.replyIndex
                ]?.comment_replies.push(res)
                show(t('reply_success'), 'success')
            } catch (e) {
            } finally {
                handleReset()
            }
        }
    }

    /**
     * 从 ip_address 中提取省份，如果没有匹配到就返回原始字符串
     */
    const extractProvince = (ip: string): string => {
        return ip.match(/(.+)(?=省)/)?.[0] ?? ip
    }

    // 评论首屏。article 进 key：同一个组件实例换了文章也不会串数据。
    // 注意不要把手写的分页状态（search.page / search.order）放进 params ——
    // 翻页是 load() 手动追加的，进了 key 会在这里再取一次并覆盖已累积的列表
    const { data: commentsData } = useApiData(
        'comments',
        () => getComments(search),
        { params: () => ({ article }) }
    )

    // 切换语言会带前缀跳转导致本组件重新挂载，此时 useAsyncData 命中
    // 同名缓存不会再次执行 handler，需从缓存结果回填本地 comments，
    // 既避免评论消失、也无需为与语言无关的评论数据重新请求
    watch(
        commentsData,
        val => {
            if (val) {
                comments.value = val
                search.count = Math.ceil(val.count / 10)
            }
        },
        { immediate: true }
    )
</script>

<template>
    <div class="comment-composer">
        <v-textarea
            v-model.trim="comment"
            variant="plain"
            density="compact"
            color="primary"
            rows="2"
            max-rows="8"
            auto-grow
            hide-details
            :placeholder="t('comment_placeholder')"
            class="comment-composer__input"
            @keydown.enter="onCommentEnter"
        />
        <div class="comment-composer__bar">
            <v-btn
                icon="mdi-emoticon-sick-outline"
                size="small"
                color="primary"
                variant="text"
                :aria-label="t('emoji')"
                @click="emojiDialog = true"
            />
            <AiMenuButton
                v-if="aiAvailable"
                :items="aiMenu"
                location="top end"
                @select="key => openAi('comment', key)"
            />
            <SpeechInput @result="onSpeechResult" />
            <v-spacer />
            <v-btn
                v-permission
                variant="flat"
                color="primary"
                :loading="commentLoading"
                :disabled="!canPost"
                data-cuelume-press
                data-cuelume-release
                @click="handlePostComment"
            >
                {{ t('post_comment') }}
            </v-btn>
        </div>
    </div>
    <div
        class="text-capitalize text-2xl d-flex justify-space-between align-center"
    >
        {{ t('comment') }}:
        <v-btn v-show="search.count" variant="text" @click="byTime"
            >{{ t('by_time') }}
            <v-icon
                color="primary"
                class="ml-2"
                :icon="
                    search.order === 'create_time'
                        ? 'mdi-sort-clock-ascending-outline'
                        : 'mdi-sort-clock-descending-outline'
                "
            ></v-icon>
        </v-btn>
    </div>
    <v-divider class="mt-6" color="surface" />
    <div v-if="comments?.results.length" ref="commentListRef">
        <DelayFade>
            <div
                v-for="(comment, index) in comments.results"
                :key="comment.id"
                class="d-flex align-start my-6"
                :data-index="index"
            >
                <v-btn size="45" icon variant="flat" class="mr-4">
                    <v-avatar size="45">
                        <v-img
                            :src="comment.user_info.avatar"
                            alt="avatar"
                        ></v-img>
                    </v-avatar>
                </v-btn>
                <div>
                    <div class="text-grey font-weight-bold">
                        {{ comment.user_info.username }}
                        <span
                            v-if="
                                mobile &&
                                comment.ip_address &&
                                comment.ip_address !== '未知'
                            "
                            class="text-grey ml-1"
                        >
                            {{ extractProvince(comment.ip_address) }}
                        </span>
                    </div>
                    <div>
                        {{ comment.content }}
                    </div>
                    <div class="text-grey"></div>
                    <div class="d-flex mt-1">
                        <div
                            v-if="
                                !mobile &&
                                comment.ip_address &&
                                comment.ip_address !== '未知'
                            "
                            class="text-grey mr-2 leading-6"
                        >
                            {{ extractProvince(comment.ip_address) }}
                        </div>
                        <div class="text-grey leading-6">
                            {{ formatNow(comment.create_time) }}
                        </div>
                        <v-btn
                            variant="text"
                            density="compact"
                            color="grey"
                            class="mx-2"
                            :disabled="!isLogin"
                            @click="handleOpen(comment, index, false)"
                        >
                            {{ t('reply') }}
                        </v-btn>
                    </div>
                    <div v-show="comment.comment_replies">
                        <div
                            v-for="(
                                reply_comment, key
                            ) in comment.comment_replies"
                            :key="reply_comment.id"
                        >
                            <div
                                v-show="key < 1 || comment.id === data.flag_id"
                            >
                                <div class="d-flex align-start my-6">
                                    <v-btn
                                        size="40"
                                        icon
                                        variant="flat"
                                        class="mr-4"
                                    >
                                        <v-avatar size="40">
                                            <v-img
                                                :src="
                                                    reply_comment.user_info
                                                        .avatar
                                                "
                                                alt="avatar"
                                            ></v-img>
                                        </v-avatar>
                                    </v-btn>
                                    <div>
                                        <div class="text-grey font-weight-bold">
                                            {{
                                                reply_comment.user_info.username
                                            }}
                                            <span
                                                v-if="
                                                    mobile &&
                                                    reply_comment.ip_address &&
                                                    reply_comment.ip_address !==
                                                        '未知'
                                                "
                                                class="text-grey ml-1"
                                            >
                                                {{
                                                    extractProvince(
                                                        reply_comment.ip_address
                                                    )
                                                }}
                                            </span>
                                        </div>
                                        <div>
                                            <span
                                                v-show="
                                                    reply_comment.reply_user
                                                "
                                                class="text-primary"
                                                >@{{
                                                    reply_comment.reply_user
                                                }}
                                                : </span
                                            >{{ reply_comment.content }}
                                        </div>
                                        <div class="d-flex mt-1">
                                            <div
                                                v-if="
                                                    !mobile &&
                                                    reply_comment.ip_address &&
                                                    reply_comment.ip_address !==
                                                        '未知'
                                                "
                                                class="text-grey mr-2 leading-6"
                                            >
                                                {{
                                                    extractProvince(
                                                        reply_comment.ip_address
                                                    )
                                                }}
                                            </div>
                                            <div class="text-grey leading-6">
                                                {{
                                                    formatNow(
                                                        reply_comment.create_time
                                                    )
                                                }}
                                            </div>
                                            <v-btn
                                                variant="text"
                                                density="compact"
                                                color="grey"
                                                class="mx-2"
                                                :disabled="!isLogin"
                                                @click="
                                                    handleOpen(
                                                        reply_comment,
                                                        index,
                                                        true
                                                    )
                                                "
                                            >
                                                {{ t('reply') }}
                                            </v-btn>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div
                                v-show="
                                    key === 1 && comment.id !== data.flag_id
                                "
                            >
                                {{ comment.comment_replies.length }}
                                {{ t('replies') }}
                                <span
                                    class="text-primary cursor-pointer"
                                    data-cuelume-press
                                    data-cuelume-release
                                    @click="viewMore(comment.id)"
                                >
                                    {{ t('view_more') }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DelayFade>
        <v-pagination
            v-if="comments.results.length"
            v-model="search.page"
            class="mt-13"
            :length="search.count"
            rounded="circle"
            @update:model-value="changePage"
        ></v-pagination>
    </div>
    <EmptyState v-else icon="mdi-forum-outline" :title="t('noc')" />
    <v-dialog
        v-model="emojiDialog"
        width="auto"
        transition="dialog-top-transition"
        @click:outside="emojiDialog = false"
    >
        <EmojiPicker
            :native="true"
            hide-search
            :disabled-groups="['flags']"
            @select="onSelectEmoji"
        />
    </v-dialog>
    <v-dialog
        v-model="replyDialog"
        width="auto"
        transition="dialog-top-transition"
        @click:outside="handleReset"
    >
        <v-card width="min(460px, 92vw)">
            <v-card-title>
                {{ t('reply_to') }} : {{ data.reply_info.reply_user }}
            </v-card-title>
            <v-card-text>
                <v-textarea
                    v-model.trim="data.reply_info.content"
                    density="comfortable"
                    color="primary"
                    variant="underlined"
                ></v-textarea>
            </v-card-text>
            <v-card-actions>
                <!--
                    功能按钮从 textarea 的 #append-inner 挪到这一行：textarea 是 5 行高，
                    图标塞在 affix 里只能贴顶或飘在中间，贴底又会压到右下角的 resize 手柄。
                    放进 actions 行后跟「确认 / 取消」同一水平线，gap 由 .v-card-actions
                    的 0.5rem 统一给。
                -->
                <v-btn
                    icon="mdi-emoticon-sick-outline"
                    size="small"
                    color="primary"
                    variant="text"
                    @click="emojiDialog = true"
                ></v-btn>
                <AiMenuButton
                    v-if="aiAvailable"
                    :items="aiMenuReply"
                    location="top end"
                    @select="key => openAi('reply', key)"
                />
                <SpeechInput @result="onSpeechResult" />
                <v-spacer />
                <v-btn
                    color="primary"
                    :loading="replyLoading"
                    @click="handleReply"
                    >{{ t('confirm') }}</v-btn
                >
                <v-btn @click="handleReset">{{ t('cancel') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <AiAssistDialog
        v-model="aiOpen"
        :actions="aiActions"
        :initial-key="aiAction"
        :source-text="aiSource"
        :max-tokens="400"
        scope="comment"
        :builtins="aiBuiltins"
        :custom-vars="CUSTOM_VARS"
        @apply="applyAi"
        @prompts-changed="onPromptsChanged"
    />
</template>

<style scoped>
    /*
     * 评论输入区：把输入框和工具栏合成一张「写留言」的卡面。
     *
     * 早先是单行 underlined 输入框，表情/魔法棒/麦克风塞在 affix 里 —— 一行高的
     * 槽位放三个图标，上下怎么都对不齐；「发表评论」又挂在 append 槽外，带着贴纸
     * 硬阴影飘在右边，整行看起来是三个互不相干的控件。改成卡面之后：
     * 输入区可以多行自适应，图标和按钮在底部同一基线上，聚焦时描边转主题色，
     * 用全站一致的「描边 + 硬阴影」语言说明「你正在这里写字」。
     */
    .comment-composer {
        /* 下面紧接「评论:」标题，留够呼吸；也容得下 focus 时浮出的 4px 硬阴影 */
        margin-bottom: 24px;
        padding: 2px 8px 8px 12px;
        border: 2px solid var(--k-ink);
        border-radius: 14px;
        background: rgb(var(--v-theme-surface));
        transition:
            border-color var(--k-speed-base) var(--k-ease-out),
            box-shadow var(--k-speed-base) var(--k-ease-out);
    }

    .comment-composer:focus-within {
        border-color: rgb(var(--v-theme-primary));
        box-shadow: 4px 4px 0 rgb(var(--v-theme-primary));
    }

    /* plain 变体本来就没有边框和底色，这里只需要把内部留白收一下，
       否则 auto-grow 的两行会被 Vuetify 的默认内边距撑得很空 */
    .comment-composer__input :deep(.v-field) {
        background: transparent;
    }

    .comment-composer__input :deep(.v-field__input) {
        min-height: 48px;
        padding-top: 10px;
        padding-bottom: 0;
        font-size: 0.95rem;
        line-height: 1.7;
    }

    .comment-composer__bar {
        display: flex;
        align-items: center;
        gap: 2px;
    }
</style>
