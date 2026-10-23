<script setup lang="ts">
    import EmojiPicker from 'vue3-emoji-picker'
    import 'vue3-emoji-picker/css'
    import type { AiAssistAction } from '#shared/types/ai'
    import { joinSpeechText } from '~/composables/useSpeechRecognition'
    interface Props {
        article: number
        /** 文章标题：AI 生成评论时作为上下文 */
        title?: string
    }
    const { article, title } = defineProps<Props>()
    const { getCommentList, postComment } = useComment()
    const { formatNow } = useDayjs()
    const { t } = useLocale()
    const { mobile } = useDisplay()
    const { show } = useToast()
    const runtimeConfig = useRuntimeConfig()
    const isLogin = useState('isLogin')
    const refreshCount = useState<number>('refreshCount')

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

    const AI_MENU = [
        { key: 'polish', label: 'ai_polish', icon: 'mdi-auto-fix' },
        {
            key: 'shorten',
            label: 'ai_shorten',
            icon: 'mdi-arrow-collapse-horizontal',
        },
        {
            key: 'friendly',
            label: 'ai_friendly',
            icon: 'mdi-emoticon-happy-outline',
        },
        {
            key: 'translate_en',
            label: 'ai_translate_en',
            icon: 'mdi-translate',
        },
        {
            key: 'translate_zh',
            label: 'ai_translate_zh',
            icon: 'mdi-translate',
        },
        {
            key: 'generate',
            label: 'ai_generate_comment',
            icon: 'mdi-comment-plus-outline',
        },
    ] as const

    const aiMenuFor = (target: 'comment' | 'reply') =>
        AI_MENU.map(item => ({
            ...item,
            // 回复框里「帮我写一条」说不通，换成「帮我回一条」
            text: t(
                item.key === 'generate' && target === 'reply'
                    ? 'ai_generate_reply'
                    : item.label
            ),
        }))

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

    const aiPrompt = (
        key: string,
        text: string,
        target: 'comment' | 'reply'
    ) => {
        const isReply = target === 'reply'
        const noun = isReply ? '回复' : '评论'
        switch (key) {
            case 'polish':
                return `请润色下面这条${noun}：保持原意和语言不变，改掉语病、重复和啰嗦的地方，读起来更自然口语化。只输出${noun}正文，不要解释。\n\n${text}`
            case 'shorten':
                return `请把下面这条${noun}精简到 30 字以内，保留核心意思和原本语气。只输出${noun}正文，不要解释。\n\n${text}`
            case 'friendly':
                return `请把下面这条${noun}改写得更热情友善一些，保持原意，不要夸张也不要谄媚，可以加一个 emoji（也可以不加）。只输出${noun}正文，不要解释。\n\n${text}`
            case 'translate_en':
                return `请把下面这条${noun}翻译成英文，保持口语化的语气。只输出译文，不要解释。\n\n${text}`
            case 'translate_zh':
                return `请把下面这条${noun}翻译成简体中文，保持口语化的语气。只输出译文，不要解释。\n\n${text}`
            case 'generate':
                // 回复评论和评论文章是两件事：前者要接住对方的话，后者才是就文章发表看法
                return isReply
                    ? `请针对文章《${title ?? ''}》下的一条评论写一条回复。${replyContext()}要求：20 到 40 字，接住对方说的具体内容（同意、补充、解释、反驳或反问都行）。${HUMAN_RULE}不要重复对方的原话。只输出回复正文。`
                    : `请针对文章《${title ?? ''}》写一条 20 到 40 字的中文评论。${HUMAN_RULE}可以提到文章里的某个点。只输出评论正文。`
            default:
                return text
        }
    }

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
                  'generate',
              ]
            : ['generate']

        return keys.map(key => {
            const item = aiMenuFor(target).find(menu => menu.key === key)
            return {
                key,
                label: item?.text ?? key,
                icon: item?.icon ?? 'mdi-auto-fix',
                prompt: aiPrompt(key, text, target),
            }
        })
    }

    const openAi = (target: 'comment' | 'reply', key: string) => {
        const text = (
            target === 'reply' ? data.reply_info.content : comment.value
        ).trim()

        if (key !== 'generate' && !text) {
            show(t('ai_need_content'), 'warning')
            return
        }

        aiTarget.value = target
        aiAction.value = key
        aiActions.value = buildAiActions(text, target)
        // generate 没有原文可看：回复时展示被回复的那条评论，评论文章时展示标题
        aiSource.value =
            key === 'generate'
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

    const { data: commentsData } = useAsyncData(
        `comments-${article}`,
        () => getComments(search),
        {
            watch: [refreshCount, () => article],
        }
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
    <div class="d-flex">
        <v-text-field
            v-model.trim="comment"
            density="compact"
            color="primary"
            variant="underlined"
            @keyup.enter="handlePostComment"
        >
            <template #prepend-inner>
                <v-btn
                    icon="mdi-emoticon-sick-outline"
                    size="small"
                    color="primary"
                    variant="text"
                    @click="emojiDialog = true"
                ></v-btn>
            </template>
            <template #append-inner>
                <AiMenuButton
                    v-if="aiAvailable"
                    :items="aiMenu"
                    location="top end"
                    @select="key => openAi('comment', key)"
                />
                <SpeechInput @result="onSpeechResult" />
            </template>
            <template #append>
                <v-btn
                    v-permission
                    variant="flat"
                    color="primary"
                    class="ml-4"
                    :loading="commentLoading"
                    data-cuelume-press
                    data-cuelume-release
                    @click="handlePostComment"
                    >{{ t('post_comment') }}</v-btn
                >
            </template>
        </v-text-field>
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
        @apply="applyAi"
    />
</template>

<style scoped></style>
