<script setup lang="ts">
    const { getArticleList } = useArticle()
    const { extractText } = useExtractText()
    const { fromNow } = useDayjs()
    const { t } = useLocale()
    const { isLogin } = useAuth()
    const refreshCount = useState('refreshCount')

    const config = useRuntimeConfig()
    const versions = config.public.versions

    // --- 状态 ---
    const articles = ref<Article[]>([])
    const loading = ref(false)
    const skeletonLoading = ref(true)
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
        'initData',
        async () => {
            const [recent, hot] = await Promise.all([
                getArticleList({ page: 1, order: '-create_time' }),
                getArticleList({ page: 1, pagesize: 10, order: '-likes' }),
            ])
            return { recent, hot }
        },
        {
            watch: [isLogin, refreshCount],
        }
    )

    useSeoMeta({
        title: 'Kotae',
        description:
            'Kotae 技术与生活笔记，每天记录和分享前端、后端与全栈经验，助你成长，寻找自己的答案。',
        ogTitle: 'Kotae',
        ogDescription:
            'Kotae 技术与生活笔记，每天记录和分享前端、后端与全栈经验，助你成长，寻找自己的答案。',
        ogUrl: 'https://kotae.cn/',
        robots: 'index, follow',
    })

    useHead({
        script: [
            {
                type: 'application/ld+json',
                innerHTML: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'ItemList',
                    itemListElement: data.value?.recent?.results.map(
                        (a, index) => ({
                            '@type': 'ListItem',
                            position: index + 1,
                            url: `https://kotae.cn/article/${a.id}`,
                            name: a.title,
                        })
                    ),
                }),
            },
        ],
    })

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

    skeletonLoading.value = false

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
                <v-skeleton-loader
                    v-for="(article, index) in articles"
                    :key="article.id"
                    :loading="skeletonLoading"
                    type="heading, list-item-three-line, chip, chip"
                    class="mb-6"
                >
                    <v-card
                        v-intersect
                        class="mr-2 border-b last:!border-0 border-dashed"
                        link
                        :rounded="0"
                        transition="fade-transition"
                        :loading="index + 1 === articles.length && loading"
                        :to="`/article/${article.id}`"
                    >
                        <template #title>
                            <h2>{{ article.title }}</h2>
                        </template>
                        <template #subtitle>
                            <div class="d-flex justify-between">
                                <span>{{ article.owner.username }}</span>
                            </div>
                        </template>
                        <template #append>
                            <v-avatar
                                @click.stop="
                                    navigateTo(`/user/${article.owner.id}`)
                                "
                            >
                                <v-img
                                    :src="article.owner.avatar"
                                    alt="avatar"
                                ></v-img>
                            </v-avatar>
                        </template>
                        <v-card-text>
                            <p class="line-clamp-2" data-allow-mismatch>
                                {{ extractText(article.content) }}
                            </p>
                            <div
                                class="d-flex justify-between text-grey text-[0.75rem] mt-3 mb-1"
                            >
                                <div>
                                    <span class="mr-4"
                                        >{{ t('view') }}:{{
                                            article.views
                                        }}</span
                                    >
                                    <span
                                        >{{ t('like') }}:{{
                                            article.likes
                                        }}</span
                                    >
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
                                        @click.stop.prevent="
                                            navigateTo({
                                                path: '/search',
                                                query: {
                                                    query: tag.name,
                                                    type: 'tag',
                                                },
                                            })
                                        "
                                    >
                                        {{ tag.name }}
                                    </v-chip>
                                </v-chip-group>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-skeleton-loader>
            </v-col>

            <v-col sm="12" md="4">
                <div class="sticky top-[6.5rem]">
                    <v-card>
                        <v-card-title class="border-b border-dashed"
                            >Popular Articles</v-card-title
                        >
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
                                link
                                :to="`/article/${article.id}`"
                            ></v-list-item>
                        </v-list>
                    </v-card>
                    <div class="mt-4">
                        <v-chip-group density="compact" column>
                            <v-hover
                                v-for="(version, key) in versions"
                                :key="key"
                                v-slot="{ isHovering, props }"
                            >
                                <v-chip
                                    :href="version.link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    v-bind="props"
                                    class="flex items-center gap-2 transition-transform duration-300"
                                >
                                    <template #prepend>
                                        <v-icon
                                            :icon="version.icon"
                                            :color="
                                                isHovering ? version.theme : ''
                                            "
                                            :class="[
                                                'transition-all duration-300',
                                                isHovering
                                                    ? `scale-125`
                                                    : 'scale-100',
                                            ]"
                                        />
                                    </template>
                                    <p class="ml-2">
                                        {{ key }} {{ version.version }}
                                    </p>
                                </v-chip>
                            </v-hover>
                        </v-chip-group>
                    </div>
                </div>
            </v-col>
        </v-row>
        <div v-show="articles?.length" ref="scrollRef"></div>
    </v-container>
</template>
