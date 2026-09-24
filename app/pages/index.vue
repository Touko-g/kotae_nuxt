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
                getArticleList({
                    page: 1,
                    pagesize: 10,
                    order: '-likes',
                }),
            ])
            return { recent, hot }
        },
        {
            watch: [isLogin, refreshCount],
        }
    )

    useSeoMeta({
        title: 'Kotae',
        description: computed(() => t('site_description')),
        ogTitle: 'Kotae',
        ogDescription: computed(() => t('site_description')),
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

    // --- 头条推荐：取最热榜第一，用 id 取模确定封面渐变（SSR 一致） ---
    const featured = computed<Article | undefined>(
        () => data.value?.hot?.results?.[0]
    )
    const featuredVariant = computed(() =>
        featured.value ? featured.value.id % 4 : 0
    )

    // --- Hero 标签跑马灯：从最新 + 最热去重取前若干 ---
    const heroTags = computed(() => {
        const seen = new Set<string>()
        const out: Tag[] = []
        const all = [
            ...(data.value?.recent?.results ?? []),
            ...(data.value?.hot?.results ?? []),
        ]
        for (const a of all) {
            for (const tag of a.tag ?? []) {
                if (!seen.has(tag.name)) {
                    seen.add(tag.name)
                    out.push(tag)
                }
            }
        }
        return out.slice(0, 14)
    })

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
    <v-container class="px-4 px-sm-6 py-6 py-sm-10">
        <!-- Hero 抬头：极光辉光 + 漂浮花饰 + 荧光词标 + 贴纸标签跑马灯 -->
        <header
            class="k-hero k-card bg-surface position-relative overflow-hidden rounded-xl mb-10 px-6 py-9 py-sm-12"
        >
            <span class="hero-blob hero-blob--a" aria-hidden="true"></span>
            <span class="hero-blob hero-blob--b" aria-hidden="true"></span>
            <span class="k-doodle k-doodle--ring" aria-hidden="true"></span>
            <span class="k-doodle k-doodle--square" aria-hidden="true"></span>
            <span class="k-doodle k-doodle--dot" aria-hidden="true"></span>
            <span class="k-doodle k-doodle--spark" aria-hidden="true"></span>
            <p
                class="text-overline text-primary font-weight-bold mb-2 anim anim-slide-down"
            >
                ✦ {{ t('hero_tagline') }}
            </p>
            <h1 class="text-h1 font-weight-bold mb-4 anim anim-pop">
                <span class="k-highlight k-gradient-text">Kotae</span>
            </h1>
            <p
                class="text-body-1 text-medium-emphasis max-w-2xl mb-7 anim anim-fade"
            >
                {{ t('site_description') }}
            </p>
            <div v-if="heroTags.length" class="marquee">
                <div class="marquee-track">
                    <template v-for="dup in 2" :key="dup">
                        <v-chip
                            v-for="tag in heroTags"
                            :key="`${dup}-${tag.id}`"
                            density="comfortable"
                            class="sticker"
                            prepend-icon="mdi-tag-outline"
                            @click="
                                navigateTo({
                                    path: '/search',
                                    query: { query: tag.name, type: 'tag' },
                                })
                            "
                        >
                            {{ tag.name }}
                        </v-chip>
                    </template>
                </div>
            </div>
        </header>

        <v-row>
            <v-col sm="12" md="8">
                <!-- 头条推荐 Featured -->
                <v-card
                    v-if="featured"
                    :to="`/article/${featured.id}`"
                    variant="flat"
                    rounded="xl"
                    class="k-card overflow-hidden mb-10 anim anim-pop"
                >
                    <div
                        :class="[
                            'featured-cover',
                            `featured-cover--${featuredVariant}`,
                        ]"
                    >
                        <div class="mb-4">
                            <span class="k-sticker-badge">
                                ★ {{ t('featured') }}
                            </span>
                        </div>
                        <h3
                            class="text-h4 font-weight-bold mb-3 line-clamp-2 leading-snug"
                        >
                            {{ featured.title }}
                        </h3>
                        <p
                            class="text-body-2 opacity-90 mb-5 line-clamp-2 leading-relaxed"
                            data-allow-mismatch
                        >
                            {{ extractText(featured.content) }}
                        </p>
                        <div
                            class="d-flex align-center justify-space-between flex-wrap gap-2"
                        >
                            <div class="flex items-center gap-2">
                                <v-avatar size="34">
                                    <v-img
                                        :src="featured.owner.avatar"
                                        :alt="featured.owner.username"
                                    />
                                </v-avatar>
                                <span class="text-caption">{{
                                    featured.owner.username
                                }}</span>
                            </div>
                            <div class="flex items-center gap-4 text-caption">
                                <span class="flex items-center gap-1">
                                    <v-icon size="16" icon="mdi-eye-outline" />
                                    {{ featured.views }}
                                </span>
                                <span class="flex items-center gap-1">
                                    <v-icon
                                        size="16"
                                        icon="mdi-heart-outline"
                                    />
                                    {{ featured.likes }}
                                </span>
                                <span>{{ fromNow(featured.create_time) }}</span>
                            </div>
                        </div>
                    </div>
                </v-card>

                <!-- Latest 分区标题 -->
                <div class="d-flex align-center mb-4">
                    <span class="section-bar mr-3" aria-hidden="true"></span>
                    <h2 class="text-h5 font-weight-bold">{{ t('latest') }}</h2>
                </div>

                <div class="stagger-up space-y-5">
                    <v-skeleton-loader
                        v-for="(article, index) in articles"
                        :key="article.id"
                        :loading="skeletonLoading"
                        type="heading, list-item-three-line, chip, chip"
                        class="mb-6"
                    >
                        <v-card
                            v-intersect
                            class="k-feed k-card mr-2 border-b last:!border-0 border-dashed"
                            link
                            :rounded="0"
                            transition="fade-transition"
                            :loading="index + 1 === articles.length && loading"
                            :to="`/article/${article.id}`"
                        >
                            <template #title>
                                <h2
                                    class="k-feed__title font-weight-bold leading-snug"
                                >
                                    {{ article.title }}
                                </h2>
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
                                <p
                                    class="line-clamp-2 leading-relaxed"
                                    data-allow-mismatch
                                >
                                    {{ extractText(article.content) }}
                                </p>
                                <div
                                    class="d-flex justify-between align-center text-grey text-[0.75rem] mt-3 mb-1"
                                >
                                    <div class="flex items-center gap-4">
                                        <span class="flex items-center gap-1">
                                            <v-icon
                                                size="14"
                                                icon="mdi-eye-outline"
                                            />
                                            {{ article.views }}
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <v-icon
                                                size="14"
                                                icon="mdi-heart-outline"
                                            />
                                            {{ article.likes }}
                                        </span>
                                    </div>
                                    <span>{{
                                        fromNow(article.create_time)
                                    }}</span>
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
                    <EmptyState
                        v-if="!articles.length"
                        icon="mdi-file-document-outline"
                        :title="t('no_articles')"
                    />
                </div>
            </v-col>

            <v-col sm="12" md="4">
                <div class="sticky top-[6.5rem]">
                    <v-card class="k-card">
                        <v-card-title class="text-h6 font-weight-bold">{{
                            t('popular')
                        }}</v-card-title>
                        <v-list activatable class="stagger-up">
                            <v-list-item
                                v-for="(article, key) in data?.hot?.results"
                                :key="article.id"
                                v-tooltip="{
                                    text: article.title,
                                    openDelay: 500,
                                }"
                                :title="article.title"
                                link
                                :to="`/article/${article.id}`"
                            >
                                <template #prepend>
                                    <span
                                        :class="[
                                            'rank-badge',
                                            key < 3
                                                ? `rank-badge--${key + 1}`
                                                : '',
                                        ]"
                                    >
                                        {{ key + 1 }}
                                    </span>
                                </template>
                            </v-list-item>
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
                                    class="sticker flex items-center gap-2 transition-transform duration-300"
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
                                        {{ key }}
                                        {{ version.version }}
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
