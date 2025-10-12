<script setup lang="ts">
    import { ref, reactive, onMounted } from 'vue'

    const { getArticleList } = useArticle()
    const { extractText } = useExtractText()
    const { fromNow } = useDayjs()
    const { t } = useLocale()
    const { isLogin } = useAuth()

    // --- 状态 ---
    const articles = ref<Article[]>([])
    const loading = ref(false)
    const page = reactive({
        page: 1,
        count: 0,
    })

    // --- 滚动触发元素 ---
    const scrollRef = useTemplateRef('scrollRef')

    // --- IntersectionObserver ---
    const observer = ref<IntersectionObserver | null>(null)

    // --- 首屏数据 ---
    const { data } = await useAsyncData(
        'articles',
        async () => {
            const [recent, hot] = await Promise.all([
                getArticleList({ page: 1, order: '-create_time' }),
                getArticleList({ page: 1, order: '-likes' }),
            ])
            return { recent, hot }
        },
        {
            watch: [isLogin],
        }
    )

    watch(
        () => data.value,
        val => {
            if (val?.recent.results) {
                articles.value = val.recent.results
                page.count = Math.ceil(val.recent.count / 10)
            }
        }
    )

    // --- 初始化文章列表 ---
    if (data.value?.recent.results) {
        articles.value = data.value.recent.results
        page.count = Math.ceil(data.value.recent.count / 10)
    }

    // --- 加载更多文章 ---
    const loadArticles = async () => {
        if (loading.value) return
        if (page.page >= page.count) return

        loading.value = true
        page.page += 1

        const { results } = await getArticleList({
            page: page.page,
            order: '-create_time',
        })

        if (results?.length) {
            articles.value.push(...results)
        }

        loading.value = false
    }

    // --- 监听滚动触发 ---
    onMounted(() => {
        if (data.value?.recent?.results) {
            articles.value = data.value.recent.results
            page.count = Math.ceil(data.value.recent.count / 10)
        }

        observer.value = new IntersectionObserver(
            async entries => {
                if (entries[0]?.isIntersecting) {
                    await loadArticles()
                }
            },
            { rootMargin: '100px' }
        )

        if (scrollRef.value && observer.value) {
            observer.value.observe(scrollRef.value)
        }
    })

    onUnmounted(() => {
        observer.value?.disconnect()
    })
</script>

<template>
    <v-container>
        <v-row class="py-6">
            <v-col sm="12" md="8">
                <v-card
                    v-for="(article, index) in articles"
                    :key="article.id"
                    v-intersect
                    class="mr-2"
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
                        <div class="d-flex justify-end">
                            <v-chip-group>
                                <v-chip
                                    v-for="tag in article.tag"
                                    :key="tag.id"
                                    density="compact"
                                    class="last:!mr-0"
                                    @click.stop="
                                        navigateTo({
                                            path: '/search',
                                            query: {
                                                query: tag.name,
                                                type: 'tag',
                                            },
                                        })
                                    "
                                    >{{ tag.name }}</v-chip
                                >
                            </v-chip-group>
                        </div>
                    </v-card-text>
                    <v-divider :opacity="0.7"></v-divider>
                </v-card>
            </v-col>

            <v-col sm="12" md="4">
                <div class="sticky top-[6.5rem]">
                    <v-card title="Popular Articles">
                        <v-divider :opacity="0.7"></v-divider>
                        <v-list activatable>
                            <v-list-item
                                v-for="(article, key) in data?.hot?.results"
                                :key="article.id"
                                v-tooltip="{
                                    text: article.title,
                                    openDelay: 500,
                                }"
                                :title="article.title"
                                :prepend-icon="`mdi-numeric-${key + 1}`"
                            ></v-list-item>
                        </v-list>
                    </v-card>

                    <v-card class="mt-4"> 其他内容 </v-card>
                </div>
            </v-col>
        </v-row>
        <div v-show="articles?.length" ref="scrollRef"></div>
    </v-container>
</template>
