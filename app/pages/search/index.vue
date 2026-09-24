<script setup lang="ts">
    const route = useRoute()
    const { t } = useLocale()
    const { getArticleList } = useArticle()
    const { extractText } = useExtractText()
    const { fromNow } = useDayjs()

    useSeoMeta({
        title: `${t('search')} : ${route.query.type}-${route.query.query}`,
        ogTitle: `${t('search')} : ${route.query.type}-${route.query.query}`,
    })

    const articles = ref<Article[]>([])
    const loading = ref(false)
    const page = reactive({
        page: 1,
        count: 0,
    })

    const scrollRef = useTemplateRef('scrollRef')
    const observer = ref<IntersectionObserver | null>(null)

    const fetchArticles = async () => {
        loading.value = true
        const { results, count } = await getArticleList({
            page: 1,
            [route.query.type as string]: route.query.query,
        })
        articles.value = results || []
        page.page = 1
        page.count = Math.ceil((count || 0) / 10)
        loading.value = false
    }

    // 初始化加载
    await fetchArticles()

    // --- 监听 query 变化重新请求 ---
    watch(
        () => ({ ...route.query }),
        async (newVal, oldVal) => {
            if (
                newVal.query !== oldVal?.query ||
                newVal.type !== oldVal?.type
            ) {
                await fetchArticles()
            }
        }
    )

    // --- 加载更多 ---
    const loadArticles = async () => {
        if (loading.value) return
        if (page.page >= page.count) return

        loading.value = true
        page.page += 1

        const { results } = await getArticleList({
            page: page.page,
            [route.query.type as string]: route.query.query,
        })
        if (results?.length) {
            articles.value.push(...results)
        }
        loading.value = false
    }

    onMounted(async () => {
        observer.value = new IntersectionObserver(
            async entries => {
                if (entries[0]?.isIntersecting) {
                    await loadArticles()
                }
            },
            { rootMargin: '100px' }
        )

        await nextTick()
        if (scrollRef.value) observer.value.observe(scrollRef.value)
    })

    onUnmounted(() => observer.value?.disconnect())
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
        <header class="page-hero anim anim-slide-down">
            <p class="page-hero__eyebrow">✦ Kotae</p>
            <h1 class="text-h4 page-hero__title">
                <span class="k-highlight">{{
                    t('search_list', route.query.query)
                }}</span>
            </h1>
        </header>
        <v-row class="py-6 stagger-up">
            <v-col v-for="(article, index) in articles" :key="article.id">
                <v-card
                    v-intersect
                    link
                    class="k-card--sm hover-lift"
                    variant="outlined"
                    rounded="lg"
                    :append-avatar="article.owner.avatar"
                    :title="article.title"
                    transition="fade-transition"
                    :loading="index + 1 === articles.length && loading"
                    @click="navigateTo(`article/${article.id}`)"
                >
                    <template #subtitle>
                        <div class="d-flex justify-between">
                            <span>{{ article.owner.username }}</span>
                        </div>
                    </template>
                    <v-card-text>
                        <p class="line-clamp-2">
                            {{ extractText(article.content) }}
                        </p>
                        <div
                            class="d-flex justify-between text-grey text-[0.75rem] mt-3 mb-1"
                        >
                            <div>
                                <span class="mr-4"
                                    >{{ t('view') }}:{{ article.views }}</span
                                >
                                <span>{{ t('like') }}:{{ article.likes }}</span>
                            </div>
                            <span>{{ fromNow(article.create_time) }}</span>
                        </div>
                    </v-card-text>
                    <v-divider :opacity="0.7"></v-divider>
                </v-card>
            </v-col>
        </v-row>
        <EmptyState
            v-if="!articles.length"
            icon="mdi-file-search-outline"
            :title="t('no_results')"
        />
        <div v-if="articles?.length" ref="scrollRef"></div>
    </v-container>
</template>

<style scoped></style>
