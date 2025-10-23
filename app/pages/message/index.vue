<script setup lang="ts">
    definePageMeta({ middleware: 'auth' })

    useSeoMeta({ title: '消息', ogTitle: '消息' })

    const { getNoticeList, readNotice } = useNotice()
    const { t } = useLocale()
    const { format } = useDayjs()

    const { data } = await useAsyncData('notice', () =>
        getNoticeList({ pagesize: 10000, order: '-create_time' })
    )

    const activeTab = ref<'reply' | 'comment'>('reply')
    const activeReplyTab = ref(0)
    const activeCommentTab = ref(0)

    const replyNotices = ref<{ read: Notice[]; unread: Notice[] } | null>(null)
    const commentNotices = ref<{ read: Notice[]; unread: Notice[] } | null>(
        null
    )

    if (data.value?.results?.length) {
        const noticeGroups = data.value.results.reduce(
            (res, cur) => {
                const key = cur.verb === '回复' ? 'reply' : 'comment'
                res[key].push(cur)
                return res
            },
            { reply: [] as Notice[], comment: [] as Notice[] }
        )

        const splitByReadStatus = (list: Notice[]) => ({
            read: list.filter(item => item.read),
            unread: list.filter(item => !item.read),
        })

        replyNotices.value = splitByReadStatus(noticeGroups.reply)
        commentNotices.value = splitByReadStatus(noticeGroups.comment)
    }

    onUnmounted(async () => {
        try {
            await readNotice({})
        } catch (error) {}
    })
</script>

<template>
    <v-row class="ma-2 ma-sm-6">
        <v-col>
            <v-card>
                <!-- 主分类 -->
                <v-tabs v-model="activeTab" color="primary" centered>
                    <v-tab value="reply">
                        <v-badge
                            v-if="replyNotices?.unread?.length"
                            dot
                            color="error"
                            floating
                        >
                            {{ t('reply') }}
                        </v-badge>
                        <span v-else>{{ t('reply') }}</span>
                    </v-tab>
                    <v-tab value="comment">
                        <v-badge
                            v-if="commentNotices?.unread?.length"
                            dot
                            color="error"
                            floating
                        >
                            {{ t('comment') }}
                        </v-badge>
                        <span v-else>{{ t('comment') }}</span>
                    </v-tab>
                </v-tabs>

                <v-card-text>
                    <v-window v-model="activeTab">
                        <!-- 回复通知 -->
                        <v-window-item value="reply">
                            <NoticePanel
                                :notices="replyNotices"
                                :active-tab="activeReplyTab"
                                :t="t"
                                :format="format"
                                label="reply_to_you"
                            />
                        </v-window-item>

                        <!-- 评论通知 -->
                        <v-window-item value="comment">
                            <NoticePanel
                                :notices="commentNotices"
                                :active-tab="activeCommentTab"
                                :t="t"
                                :format="format"
                                label="comment_to_you"
                            />
                        </v-window-item>
                    </v-window>
                </v-card-text> </v-card
        ></v-col>
    </v-row>
</template>
