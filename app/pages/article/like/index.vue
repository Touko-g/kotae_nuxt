<script setup lang="ts">
    import { ref } from 'vue'

    definePageMeta({
        middleware: 'auth',
    })

    const { t } = useLocale()

    useSeoMeta({
        title: computed(() => t('like_article')),
        ogTitle: computed(() => t('like_article')),
    })

    const { getLikeList, delLike } = useLike()
    const { show } = useSnackbar()

    const likes = ref<Like[]>([])
    const loading = ref(false)
    const page = reactive({
        page: 1,
        count: 0,
    })

    const scrollRef = useTemplateRef('scrollRef')
    const observer = ref<IntersectionObserver | null>(null)

    const { data } = await useAsyncData('likes', () =>
        getLikeList({
            ...page,
        })
    )

    if (data.value?.results) {
        likes.value = data.value.results
        page.count = Math.ceil(data.value.count / 10)
    }

    const loadLikes = async () => {
        if (loading.value) return
        if (page.page >= page.count) return

        loading.value = true
        page.page += 1

        const { results } = await getLikeList({
            page: page.page,
        })

        if (results?.length) {
            likes.value.push(...results)
        }

        loading.value = false
    }

    const handleDel = async (id: string | number) => {
        await delLike(id)
        likes.value = likes.value.filter(like => like.id !== id)
        show(t('unlike'), 'success')
    }

    onMounted(async () => {
        observer.value = new IntersectionObserver(
            async entries => {
                if (entries[0]?.isIntersecting) {
                    await loadLikes()
                }
            },
            { rootMargin: '100px' }
        )

        await nextTick()
        if (scrollRef.value) {
            observer.value.observe(scrollRef.value)
        }
    })

    onUnmounted(() => {
        observer.value?.disconnect()
    })
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
        <!-- 标题栏 -->
        <v-alert
            class="mb-8 text-lg font-semibold tracking-wide border border-gray-700 dark:border-gray-600 bg-transparent text-gray-200"
            variant="outlined"
            elevation="1"
            :text="t('like_list')"
        />

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
                    class="hover-lift"
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
