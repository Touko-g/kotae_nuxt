<script setup lang="ts">
    const route = useRoute()
    const { t } = useLocale()
    const { getArticleList } = useArticle()
    const { extractText } = useExtractText()
    const { fromNow } = useDayjs()

    const PAGESIZE = 10

    // 搜索条件全部来自 URL：进 key 之后，换关键词 / 换搜索类型会自动重新取数，
    // 不用再手写 watch(route.query) 那一套
    const condition = computed(() => ({
        type: String(route.query.type ?? ''),
        query: String(route.query.query ?? ''),
    }))

    useSeoMeta({
        // 写成 getter：站内跳转不重跑 setup，写死的话标题会停在上一次搜索
        title: () =>
            `${t('search')} : ${condition.value.type}-${condition.value.query}`,
        ogTitle: () =>
            `${t('search')} : ${condition.value.type}-${condition.value.query}`,
    })

    const { data } = await useApiData(
        'search',
        p =>
            getArticleList({
                page: 1,
                pagesize: PAGESIZE,
                [p.type]: p.query,
            }),
        { params: () => condition.value }
    )

    const {
        items: articles,
        loading,
        scrollRef,
    } = useInfiniteList<Article>({
        pagesize: PAGESIZE,
        initial: () => data.value,
        fetchPage: page =>
            getArticleList({
                page,
                pagesize: PAGESIZE,
                [condition.value.type]: condition.value.query,
            }),
    })
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
