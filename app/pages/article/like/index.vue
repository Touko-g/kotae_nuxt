<script setup lang="ts">
    definePageMeta({
        middleware: 'auth',
    })

    useSeoMeta({
        title: '喜欢的文章',
        ogTitle: '喜欢的文章',
    })

    const { getLikeList, delLike } = useLike()
    const { t } = useLocale()
    const { show } = useSnackbar()

    const {
        items: likes,
        loading,
        scrollRef,
        initItems,
    } = useInfiniteScroll<Like>(page => getLikeList({ page }))

    const { data } = await useAsyncData('likes', () => getLikeList({ page: 1 }))

    if (data.value) {
        initItems(data.value)
    }

    const handleDel = async (id: string | number) => {
        await delLike(id)
        likes.value = likes.value.filter(like => like.id !== id)
        show(t('unlike'), 'success')
    }
</script>

<template>
    <v-container class="max-w-5xl mx-auto px-4 py-10">
        <!-- 标题栏 -->
        <v-alert
            class="mb-8 text-lg font-semibold tracking-wide border border-gray-700 dark:border-gray-600 bg-transparent text-gray-200"
            variant="outlined"
            elevation="1"
            :text="t('like_list')"
        />

        <!-- 列表 -->
        <v-row>
            <v-col
                v-for="(like, index) in likes"
                :key="like.id"
                cols="12"
                sm="6"
                md="6"
            >
                <v-card
                    link
                    rounded="lg"
                    variant="outlined"
                    :prepend-avatar="like.article_info.avatar"
                    :title="like.article_info.title"
                    :loading="index + 1 === likes.length && loading"
                    @click="navigateTo(`/article/${like.article}`)"
                >
                    <!-- 作者信息 -->
                    <template #subtitle>
                        <div class="flex justify-between text-sm text-gray-400">
                            <span>{{ like.article_info.user }}</span>
                        </div>
                    </template>

                    <!-- 删除按钮 -->
                    <template #append>
                        <v-btn
                            icon="mdi-close"
                            variant="text"
                            @click.stop="handleDel(like.id)"
                        />
                    </template>
                </v-card>
            </v-col>
        </v-row>
        <div v-if="likes?.length" ref="scrollRef"></div>
    </v-container>
</template>

<style scoped></style>
