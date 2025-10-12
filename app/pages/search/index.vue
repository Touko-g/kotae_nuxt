<script setup lang="ts">
    import { onMounted, ref } from 'vue'

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

    const { data } = await useAsyncData('search', () =>
        getArticleList({
            ...page,
            [route.query.type as string]: route.query.query,
        })
    )

    if (data.value?.results) {
        articles.value = data.value.results
        page.count = Math.ceil(data.value.count / 10)
    }

    // --- 加载更多文章 ---
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
        if (data.value?.results) {
            articles.value = data.value.results
            page.count = Math.ceil(data.value.count / 10)
        }

        observer.value = new IntersectionObserver(
            async entries => {
                if (entries[0]?.isIntersecting) {
                    await loadArticles()
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
    <v-container>
        <v-alert
            class="mt-5"
            variant="outlined"
            elevation="1"
            :text="t(`search_list`, route.query.query)"
        ></v-alert>
        <v-row class="py-6">
            <v-col v-if="articles">
                <v-card
                    v-for="(article, index) in articles"
                    :key="article.id"
                    v-intersect
                    link
                    :rounded="0"
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
        <div v-if="articles?.length" ref="scrollRef"></div>
    </v-container>
</template>

<style scoped></style>
