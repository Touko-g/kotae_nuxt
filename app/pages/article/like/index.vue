<script setup lang="ts">
    definePageMeta({
        middleware: 'auth',
    })

    const { t } = useLocale()

    useSeoMeta({
        title: computed(() => t('like_article')),
        ogTitle: computed(() => t('like_article')),
    })

    const { getLikeList, delLike } = useLike()
    const { show } = useToast()

    const PAGESIZE = 10

    const { data } = await useApiData(
        'likes',
        p => getLikeList({ page: 1, pagesize: p.pagesize }),
        { params: () => ({ pagesize: PAGESIZE }) }
    )

    const {
        items: likes,
        loading,
        scrollRef,
    } = useInfiniteList<Like>({
        pagesize: PAGESIZE,
        initial: () => data.value,
        fetchPage: page => getLikeList({ page, pagesize: PAGESIZE }),
    })

    const handleDel = async (id: string | number) => {
        await delLike(id)
        likes.value = likes.value.filter(like => like.id !== id)
        show(t('unlike'), 'success')
    }
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
        <!-- 标题栏 -->
        <header class="page-hero anim anim-slide-down">
            <p class="page-hero__eyebrow">✦ Kotae</p>
            <h1 class="text-h4 page-hero__title">
                <span class="k-highlight">{{ t('like_list') }}</span>
            </h1>
        </header>

        <!-- 列表 -->
        <v-row class="stagger-up">
            <v-col
                v-for="(like, index) in likes"
                :key="like.id"
                cols="12"
                sm="6"
                md="6"
            >
                <v-card
                    link
                    class="k-card--sm hover-lift"
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
        <EmptyState
            v-if="!likes.length"
            icon="mdi-heart-outline"
            :title="t('no_likes')"
        />
        <div v-if="likes?.length" ref="scrollRef"></div>
    </v-container>
</template>

<style scoped></style>
