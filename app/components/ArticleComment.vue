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

    const comment = ref('')
    const comments = ref<CommentListResponse | null>(null)
    const search = reactive({
        page: 1,
        pageSize: 10,
        count: 0,
        order: 'create_time',
    })

    const emojiDialog = ref(false)

    const data = reactive({
        dialog: false,
        reply_info: {
            article: 0,
            reply: 0,
            content: '',
            k: 0,
        },
        reply_user_info: null,
        flag_id: 0,
    })

    const getComments = async (params: CommentListParams) => {
        comments.value = await getCommentList({ article, ...params })
        search.count = Math.ceil(comments.value.count / 10)
    }

    const onSelectEmoji = (emoji: any) => {
        comment.value += emoji.i
    }

    const handlePostComment = async () => {}

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
     * 从 ip_address 中提取省份，如果没有匹配到就返回原始字符串
     */
    const extractProvince = (ip: string): string => {
        return ip.match(/(.+)(?=省)/)?.[0] ?? ip
    }

    getComments(search)
</script>

<template>
    <div class="d-flex">
        <v-text-field
            v-model="comment"
            density="comfortable"
            color="primary"
            variant="underlined"
            @keyup.enter="handlePostComment"
        >
            <template #prepend-inner>
                <v-btn
                    icon="mdi-emoticon-sick-outline"
                    size="small"
                    color="primary"
                    variant="plain"
                    @click="emojiDialog = true"
                ></v-btn>
            </template>
            <template #append>
                <v-btn
                    variant="flat"
                    color="primary"
                    class="ml-4"
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
    <div v-if="comments?.results.length" ref="el">
        <DelayFade>
            <div
                v-for="(comment, k) in comments.results"
                :key="comment.id"
                class="d-flex align-start my-6"
                :data-index="k"
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
</template>

<style scoped></style>
