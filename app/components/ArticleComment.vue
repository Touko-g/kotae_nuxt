<script setup lang="ts">
    import EmojiPicker from 'vue3-emoji-picker'
    import 'vue3-emoji-picker/css'
    interface Props {
        article: number
    }
    const { article } = defineProps<Props>()
    const { getCommentList, postComment } = useComment()
    const { formatNow } = useDayjs()
    const { t } = useLocale()
    const { mobile } = useDisplay()
    const { show } = useSnackbar()
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
        },
        flag_id: 0,
    })

    const getComments = async (params: CommentListParams) => {
        comments.value = await getCommentList({ article, ...params })
        search.count = Math.ceil(comments.value.count / 10)
    }

    const onSelectEmoji = (emoji: any) => {
        if (replyDialog.value) {
            data.reply_info.content += emoji.i
        } else comment.value += emoji.i
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
        replyDialog.value = true
    }

    /**
     * 重置回复弹窗
     */
    const handleReset = () => {
        replyDialog.value = false
        data.reply_info.content = ''
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

    useAsyncData('comments', () => getComments(search), {
        watch: [refreshCount],
    })
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
            <template #append>
                <v-btn
                    v-permission
                    variant="flat"
                    color="primary"
                    class="ml-4"
                    :loading="commentLoading"
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
                                    class="text-primary"
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
    <div v-else class="my-2 text-grey">{{ t('noc') }}</div>
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
        <v-card width="300">
            <v-card-title> To : {{ data.reply_info.reply_user }} </v-card-title>
            <v-card-text>
                <v-textarea
                    v-model.trim="data.reply_info.content"
                    density="comfortable"
                    color="primary"
                    variant="underlined"
                />
                <v-btn
                    icon="mdi-emoticon-sick-outline"
                    color="primary"
                    class="mr-2"
                    variant="plain"
                    @click="emojiDialog = true"
                ></v-btn>
            </v-card-text>
            <v-card-actions>
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
</template>

<style scoped></style>
