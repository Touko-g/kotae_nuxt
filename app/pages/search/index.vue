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

    const {
        items: articles,
        loading,
        scrollRef,
        initItems,
        resetPage,
    } = useInfiniteScroll<Article>(page =>
        getArticleList({
            page,
            [route.query.type as string]: route.query.query,
        })
    )

    const fetchArticles = async () => {
        loading.value = true
        resetPage()
        const data = await getArticleList({
            page: 1,
            [route.query.type as string]: route.query.query,
        })
        initItems({ results: data.results || [], count: data.count || 0 })
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
</script>

<template>
    <v-container class="max-w-5xl mx-auto px-4 py-10">
        <v-alert
            class="mt-5"
            variant="outlined"
            elevation="1"
            :text="t(`search_list`, route.query.query)"
        ></v-alert>
        <v-row class="py-6">
            <v-col v-for="(article, index) in articles" :key="article.id">
                <v-card
                    v-intersect
                    link
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
        <div v-if="articles?.length" ref="scrollRef"></div>
    </v-container>
</template>

<style scoped></style>
