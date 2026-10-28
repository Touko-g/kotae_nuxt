<script setup lang="ts">
    import type { ConfirmDialog } from '#components'
    import type { AiAssistAction } from '#shared/types/ai'
    const route = useRoute()
    const siteUrl = useRuntimeConfig().public.siteUrl

    const { getArticle, getArticleList, delArticle } = useArticle()
    const { getLikeList, addLike, delLike } = useLike()

    const { fromNow } = useDayjs()
    const { t, current } = useLocale()
    const { mobile } = useDisplay()
    const { name } = useTheme()
    const { show } = useToast()
    const { extractText } = useExtractText()
    const { countWords, readingMinutes } = useReadingTime()
    const { soundSparkle, soundTick } = useSound()
    const { fire: fireConfetti } = useConfetti()

    const highlighter = await useShiki()
    const isLogin = useState('isLogin')
    const user = useCookie<User>('user')

    const confirmRef = ref<InstanceType<typeof ConfirmDialog>>()

    /**
     * 路由参数必须跟着 URL 走。
     * /article/1 → /article/2 时 Nuxt 会用插值后的路径做 page key，组件确实会重建，
     * 但 useAsyncData 发现同名 key 已有一份 status='success' 的缓存时**不会重新请求**
     * （重新挂载也不请求）。所以 key 必须带上 id，否则从「相关阅读」点进去，
     * 页面拿到的还是上一篇的数据 —— 看起来就是「点了没反应」。
     */
    const id = computed(() => String(route.params.id ?? ''))

    // 服务器端渲染加载
    // id 交给 useApiData 做参数：它既进 key，也进 fetcher —— 换文章必然重新取数
    const { data: article } = await useApiData(
        'article',
        p => getArticle(p.id),
        { params: () => ({ id: id.value }) }
    )

    const { data: like, refresh: refreshLike } = await useApiData(
        'like',
        p => getLikeList({ article: p.id, pagesize: 10000 }),
        { params: () => ({ id: id.value }) }
    )

    // 正文渲染：高亮 + 净化都在派生层完成，SSR 与客户端同一套结果
    const { html: renderedHtml } = useArticleHtml({
        html: () => article.value?.content,
        themeName: () => name.value,
        highlighter,
    })

    // --- 预计阅读时间 / 字数（纯函数，SSR 与客户端一致）---
    const wordCount = computed(() =>
        article.value ? countWords(extractText(article.value.content)) : 0
    )
    const readMinutes = computed(() => readingMinutes(wordCount.value))

    /**
     * 传给评论区的正文摘要。
     * AI「帮我写一条」要基于文章内容写，只有标题它只能瞎猜；
     * 截断到 1200 字，别把上下文撑爆。
     */
    const articleExcerpt = computed(() =>
        article.value ? extractText(article.value.content).slice(0, 1200) : ''
    )

    // --- 相关阅读：取本文首个标签的同标签文章，排除自身最多 5 篇 ---
    // 参数放的是「标签」，不是「文章 id」：推荐列表的入参本来就是标签。
    // 标签还没取到（正文未回来 / 本文无标签）时 fetcher 直接返回空、不发请求；
    // 等 article 到手，key 里的 tag 变了，自动补一次。
    const { data: relatedArticles } = await useApiData(
        'related',
        async p => {
            if (!p.tag) return [] as Article[]
            const { results } = await getArticleList({
                page: 1,
                pagesize: 7,
                tag: p.tag,
            })
            return (results || [])
                .filter(a => a.id !== Number(p.id))
                .slice(0, 5)
        },
        {
            params: () => {
                // 换文章的瞬间 article 还是上一篇，取它的标签会推荐出上一组
                const current = article.value
                const matched =
                    current && String(current.id) === id.value
                        ? current
                        : undefined
                return { id: id.value, tag: matched?.tag?.[0]?.name }
            },
        }
    )

    // --- SEO ---
    // 站内跳转不重跑 setup，所以 meta 必须写成 getter：写死成一次性赋值的话，
    // 从相关阅读点进下一篇，标签页标题和 og:* 还是上一篇的
    const seoDescription = computed(() =>
        article.value ? extractText(article.value.content).slice(0, 160) : ''
    )
    const seoUrl = computed(
        () => `${siteUrl}/article/${article.value?.id ?? ''}`
    )

    /**
     * 正文首图，给 og:image / twitter:image 用。
     *
     * 没有这个标签时，社交平台和 RSS 阅读器抓原文页拿不到配图，分享出去就是一张
     * 空白卡片。正文里的图可能是相对路径，必须补成绝对地址 —— 抓取方没有 base。
     */
    const coverImage = computed(() => {
        const html = article.value?.content || ''
        const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || ''
        if (!src) return ''
        if (/^https?:\/\//i.test(src)) return src
        // 协议相对地址（//cdn.xxx）补协议；其余按站点根路径拼
        if (src.startsWith('//')) return `https:${src}`
        return `${siteUrl}${src.startsWith('/') ? '' : '/'}${src}`
    })

    useSeoMeta({
        title: () => article.value?.title || 'Kotae',
        ogTitle: () => article.value?.title || 'Kotae - 记录 · 创作 · 分享',
        description: () =>
            seoDescription.value || 'Kotae 记录 创作 分享，寻找你的答案',
        ogDescription: () =>
            seoDescription.value || 'Kotae 记录 创作 分享，寻找你的答案',
        ogType: 'article',
        ogUrl: () => seoUrl.value,
        ogImage: () => coverImage.value || undefined,
        // 大图卡片只在真有图时启用，否则会渲染成一块空白
        twitterCard: () =>
            coverImage.value ? 'summary_large_image' : 'summary',
        twitterImage: () => coverImage.value || undefined,
    })

    useHead({
        script: computed(() =>
            article.value
                ? [
                      {
                          type: 'application/ld+json',
                          innerHTML: JSON.stringify({
                              '@context': 'https://schema.org',
                              '@type': 'BlogPosting',
                              headline: article.value.title,
                              description: seoDescription.value,
                              author: {
                                  '@type': 'Person',
                                  name: article.value.owner.username,
                              },
                              datePublished: article.value.create_time,
                              dateModified: article.value.update_time,
                              mainEntityOfPage: {
                                  '@type': 'WebPage',
                                  '@id': seoUrl.value,
                              },
                          }),
                      },
                  ]
                : []
        ),
    })

    const handleEdit = () => {
        if (!isLogin.value) return
        navigateTo(`/article/edit/${id.value}`)
    }

    const handleOpenDel = async () => {
        if (!isLogin.value || !confirmRef.value) return
        const confirmed = await confirmRef.value.open('del_article')
        if (!confirmed) return
        if (article.value) {
            try {
                await delArticle(article.value.id)
                show(t('article_delete_success'), 'success')
                navigateTo('/')
            } catch (e) {}
        }
    }

    const likePop = ref(false)
    const countPop = ref(false)

    // --- 分享：优先调用系统原生分享，不支持/失败则复制链接到剪贴板 ---
    const handleShare = async () => {
        const url = window.location.href
        const title = article.value?.title ?? ''
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({ title, url })
                return
            } catch (err) {
                // 用户主动取消则不打扰，其他异常降级为复制
                if ((err as DOMException)?.name === 'AbortError') return
            }
        }
        await copyToClipboard(url)
        soundTick()
        show(t('link_copied'), 'success')
    }

    // 展示用点赞数：本地点赞时即时 +1，服务端回流后自动对齐，避免数字来回跳
    const displayedLikes = ref(0)
    watch(
        () => article.value?.likes ?? 0,
        val => {
            displayedLikes.value = val
        },
        { immediate: true }
    )

    // 点赞态与点赞记录 id：用本地 ref 维护，服务端 like 列表回流时回填。
    // 点赞/取消后仅本地更新，不再 bump 全局 refreshCount，
    // 避免连带触发 article / like / comment 三个接口
    const isLike = ref(false)
    const myLikeId = ref<number | undefined>(undefined)

    watch(
        () => like.value?.results,
        results => {
            const userId = user.value?.id
            const mine =
                userId && results
                    ? results.find(item => item.user_info.id === userId)
                    : undefined
            isLike.value = !!mine
            myLikeId.value = mine?.id
        },
        { immediate: true }
    )

    const likeLoading = ref(false)

    // 计数跳动动画（点赞 +1 / 取消 -1 复用）
    const popCount = async () => {
        countPop.value = false
        await nextTick()
        countPop.value = true
        setTimeout(() => (countPop.value = false), 460)
    }

    const handleLike = async (e?: MouseEvent) => {
        if (!isLogin.value || likeLoading.value) return
        // 同步捕获撒花原点：锚定到点赞按钮中心（await 之后 e.currentTarget 会失效）
        const btn = e?.currentTarget as HTMLElement | undefined
        const origin = btn
            ? (() => {
                  const r = btn.getBoundingClientRect()
                  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
              })()
            : e
              ? { x: e.clientX, y: e.clientY }
              : undefined
        const liked = isLike.value
        const likeId = myLikeId.value
        // 取消点赞但拿不到记录 id（数据未就绪）时直接返回，避免误调接口
        if (liked && likeId === undefined) return
        likeLoading.value = true
        try {
            if (liked) {
                // 取消点赞：仅本地更新 + 轻音效，不播放心跳/环形扩散
                await delLike(likeId!)
                soundTick()
                isLike.value = false
                myLikeId.value = undefined
                displayedLikes.value = Math.max(0, displayedLikes.value - 1)
                await popCount()
            } else {
                // 点赞：心跳 + 环形扩散 + 撒花 + 计数 +1
                const rec = await addLike({ article: article.value?.id })
                soundSparkle()
                // 从按钮中心向上绽放，避免花束直接下坠出视口
                fireConfetti(origin, 120, { upward: 160 })
                isLike.value = true
                myLikeId.value = rec?.id
                // 兜底：若创建响应未带回记录 id，仅刷新 like 列表回填
                // （只重取本页这条数据，不牵动 article / comment）
                if (myLikeId.value === undefined) {
                    await refreshLike()
                }
                likePop.value = false
                await nextTick()
                likePop.value = true
                setTimeout(() => (likePop.value = false), 600)
                displayedLikes.value += 1
                await popCount()
            }
        } catch (e) {
        } finally {
            likeLoading.value = false
        }
    }

    // --- 正文增强：目录 / 代码复制 / 图片灯箱 / 阅读进度 ---
    // 全是对渲染后 HTML 的 DOM 后处理，逻辑在 useArticleEnhance 里，
    // 页面这边只接模板 ref 和状态
    const {
        markdownRef,
        tocNavRef,
        toc,
        activeId,
        progress,
        indicator,
        scrollToHeading,
        lightboxVisible,
        lightboxImages,
        lightboxIndex,
    } = useArticleEnhance({ html: () => renderedHtml.value })

    /** 朗读组件自己去正文里收集段落，这里只把容器递出去 */
    const getContentEl = () => markdownRef.value

    // --- 划词问 AI ---
    // 选区探测交给 useTextSelection，这里只决定「点了哪个动作、发什么提示词」。
    // 浮条只在登录且站点开着 AI 时出现：未登录点了也只会撞 401。
    const aiClient = useAiClient()

    const {
        visible: askVisible,
        text: askText,
        anchor: askAnchor,
        hide: hideAsk,
    } = useTextSelection({
        container: () => markdownRef.value,
        enabled: () => aiClient.available.value,
    })

    /** 回答语言跟着界面走：中文界面用中文解释，英文界面用英文 */
    const answerLang = computed(() =>
        current.value === 'zh' ? '中文' : '英文'
    )
    /** 翻译的目标语言永远是「另一种」 */
    const translateTarget = computed(() =>
        current.value === 'zh' ? '英文' : '中文'
    )

    /**
     * 三个内置动作。
     *
     * 提示词在这里拼而不是在面板里：面板拿到的就是最终要发出去的那段话，
     * 它不需要知道选中了什么、也不需要知道界面语言。
     */
    const ASK_ACTIONS = [
        {
            key: 'explain',
            icon: 'mdi-comment-quote-outline',
            labelKey: 'sel_explain',
            rule: () =>
                `解释下面这段文字在说什么：说清它的意思和关键概念，不要复述原文，控制在 200 字以内。用${answerLang.value}回答。`,
        },
        {
            key: 'translate',
            icon: 'mdi-translate',
            labelKey: 'sel_translate',
            rule: () =>
                `把下面这段文字翻译成${translateTarget.value}，只输出译文，不要任何解释。`,
        },
        {
            key: 'expand',
            icon: 'mdi-arrow-expand-horizontal',
            labelKey: 'sel_expand',
            rule: () =>
                `围绕下面这段文字展开讲讲：补充背景、原因或者一个具体例子，300 字以内。用${answerLang.value}回答。`,
        },
    ]

    const askChips = computed(() =>
        ASK_ACTIONS.map(action => ({
            key: action.key,
            label: t(action.labelKey),
            icon: action.icon,
        }))
    )

    const askOpen = ref(false)
    const askKey = ref('explain')
    /**
     * 打开面板时把选中文字冻结下来。
     * 不能直接读 askText：浮条一收起选区就没了，而面板在整个生成过程中都要
     * 拿它当原文（重新生成、换动作都还要用）。
     */
    const askSource = ref('')

    const askActions = computed<AiAssistAction[]>(() => {
        const text = askSource.value
        if (!text) return []
        return ASK_ACTIONS.map(action => ({
            key: action.key,
            label: t(action.labelKey),
            icon: action.icon,
            format: 'text' as const,
            prompt: `${action.rule()}\n\n${text}`,
        }))
    })

    const openAsk = (key: string) => {
        if (!askText.value) return
        askSource.value = askText.value
        askKey.value = key
        hideAsk()
        askOpen.value = true
    }

    /** 划词场景没有「写回正文」这回事，主按钮就是复制结果 */
    const handleAskApply = async (result: string) => {
        await copyToClipboard(result)
        soundTick()
        show(t('ai_copied'), 'success')
    }
</script>

<template>
    <v-container class="px-4 px-sm-6 py-6 py-sm-10">
        <v-row v-if="article">
            <!-- 主内容 -->
            <v-col :cols="toc.length && !mobile ? 9 : 12">
                <v-card variant="text" class="k-card pa-2 pa-sm-4">
                    <v-card-title>
                        <div class="d-flex">
                            <v-btn
                                v-permission
                                size="60"
                                icon
                                variant="flat"
                                @click="navigateTo(`/user/${article.owner.id}`)"
                            >
                                <v-avatar size="60">
                                    <v-img
                                        :src="article.owner.avatar"
                                        :alt="article.owner.username"
                                    ></v-img>
                                </v-avatar>
                            </v-btn>
                            <div class="d-flex flex-column justify-center ml-4">
                                <span>{{ article.owner.username }}</span>
                                <div class="text-sm text-grey">
                                    <span>{{
                                        fromNow(article.create_time)
                                    }}</span
                                    ><span class="mx-2">|</span>
                                    <span
                                        >{{ t('view') }}:{{
                                            article.views
                                        }}</span
                                    ><span v-if="!mobile" class="mx-2">|</span>
                                    <span v-if="!mobile"
                                        >{{ t('comment') }}:{{
                                            article.comments
                                        }}</span
                                    >
                                    <template v-if="!mobile">
                                        <span class="mx-2">|</span>
                                        <span
                                            >{{ t('min_short', readMinutes) }}
                                            ·
                                            {{
                                                t('words_count', wordCount)
                                            }}</span
                                        >
                                    </template>
                                </div>
                            </div>
                        </div>
                    </v-card-title>
                    <v-card-text class="mt-4">
                        <h2 class="text-4xl my-4 leading-tight tracking-tight">
                            <span class="k-highlight">{{ article.title }}</span>
                        </h2>
                        <div>
                            <!-- eslint-disable vue/no-v-html -->
                            <div
                                ref="markdownRef"
                                class="markdown-body"
                                v-html="renderedHtml"
                            ></div>
                            <div class="d-sm-flex align-center mt-6">
                                <h3
                                    class="text-grey text-capitalize text-xl mr-2"
                                >
                                    {{ t('tag') }}:
                                </h3>
                                <v-chip-group
                                    active-class="primary--text"
                                    column
                                >
                                    <v-chip
                                        v-for="(tag, index) in article.tag"
                                        :key="index"
                                        @click="
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
                            <div
                                class="d-flex justify-space-between align-center mt-2"
                            >
                                <div class="d-flex align-center">
                                    <v-btn
                                        variant="text"
                                        icon="mdi-comment-outline"
                                    ></v-btn>
                                    <span>{{ article.comments }}</span>
                                    <v-btn
                                        variant="text"
                                        icon="mdi-share-variant-outline"
                                        class="ml-3"
                                        :aria-label="t('share')"
                                        :title="t('share')"
                                        @click="handleShare"
                                    />
                                    <ReadAloudBar
                                        class="ml-1"
                                        :container="getContentEl"
                                    />
                                </div>
                                <div class="d-flex align-center">
                                    <v-btn
                                        v-if="
                                            article.public &&
                                            article.owner.id === user?.id
                                        "
                                        v-permission
                                        icon="mdi-circle-edit-outline"
                                        variant="text"
                                        @click="handleEdit"
                                    />

                                    <v-btn
                                        v-if="
                                            article.public &&
                                            article.owner.id === user?.id
                                        "
                                        v-permission
                                        icon="mdi-trash-can-outline"
                                        variant="text"
                                        @click="handleOpenDel"
                                    />
                                    <v-btn
                                        v-permission
                                        :icon="
                                            isLike
                                                ? 'mdi-thumb-up'
                                                : 'mdi-thumb-up-outline'
                                        "
                                        variant="text"
                                        :color="isLike ? 'primary' : ''"
                                        :class="[
                                            'like-pop',
                                            likePop && 'k-pop-run',
                                        ]"
                                        data-cuelume-manual
                                        @click="handleLike"
                                    />
                                    <span
                                        v-if="displayedLikes"
                                        class="like-count ml-1"
                                        :class="[
                                            isLike && 'text-primary',
                                            countPop && 'k-count-run',
                                        ]"
                                        >{{ displayedLikes }}</span
                                    >
                                </div>
                            </div>
                        </div>
                        <!-- 相关阅读：同标签推荐 -->
                        <div v-if="relatedArticles?.length" class="mt-10 mb-5">
                            <div class="d-flex align-center mb-4">
                                <span
                                    class="section-bar mr-3"
                                    aria-hidden="true"
                                ></span>
                                <h3 class="text-h6 font-weight-bold mb-0">
                                    {{ t('related_articles') }}
                                </h3>
                            </div>
                            <v-row>
                                <v-col
                                    v-for="r in relatedArticles"
                                    :key="r.id"
                                    cols="12"
                                    sm="6"
                                >
                                    <v-card
                                        :to="`/article/${r.id}`"
                                        variant="flat"
                                        class="k-card--sm pa-4 h-100"
                                    >
                                        <div
                                            class="text-subtitle-1 font-weight-bold line-clamp-2 mb-2 leading-snug"
                                        >
                                            {{ r.title }}
                                        </div>
                                        <div
                                            class="d-flex align-center text-caption text-medium-emphasis"
                                        >
                                            <div
                                                class="flex items-center gap-4"
                                            >
                                                <span
                                                    class="flex items-center gap-1"
                                                >
                                                    <v-icon
                                                        size="14"
                                                        icon="mdi-eye-outline"
                                                    />
                                                    {{ r.views }}
                                                </span>
                                                <span
                                                    class="flex items-center gap-1"
                                                >
                                                    <v-icon
                                                        size="14"
                                                        icon="mdi-heart-outline"
                                                    />
                                                    {{ r.likes }}
                                                </span>
                                            </div>
                                            <span class="ml-auto">{{
                                                fromNow(r.create_time)
                                            }}</span>
                                        </div>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </div>
                        <ArticleComment
                            :article="article.id"
                            :title="article.title"
                            :excerpt="articleExcerpt"
                        />
                    </v-card-text>
                    <ConfirmDialog ref="confirmRef" />
                </v-card>
            </v-col>

            <!-- TOC 目录 -->
            <v-col v-if="toc.length && !mobile" cols="3">
                <div class="toc-wrapper k-card pa-4 sticky top-[5.5rem]">
                    <div class="d-flex align-center mb-2">
                        <p
                            class="font-semibold text-uppercase mb-0 font-weight-medium"
                            style="letter-spacing: 0.08em"
                        >
                            {{ t('toc') }}
                        </p>
                        <span
                            class="font-semibold ml-auto font-weight-medium text-primary"
                        >
                            {{ Math.round(progress) }}%
                        </span>
                    </div>
                    <div class="toc-progress">
                        <div
                            class="toc-progress-bar"
                            :style="{ width: `${progress}%` }"
                        ></div>
                    </div>
                    <div ref="tocNavRef" class="toc-nav">
                        <div
                            class="toc-indicator"
                            :style="{
                                top: `${indicator.top}px`,
                                height: `${indicator.height}px`,
                                opacity: indicator.height ? 1 : 0,
                            }"
                        ></div>
                        <div
                            v-for="item in toc"
                            :key="item.id"
                            :data-toc-id="item.id"
                            class="toc-item text-truncate"
                            :class="[
                                `toc-level-${item.level}`,
                                { 'toc-active': activeId === item.id },
                            ]"
                            @click="scrollToHeading(item.id)"
                        >
                            {{ item.text }}
                        </div>
                    </div>
                </div>
            </v-col>
        </v-row>
        <EmptyState
            v-else
            icon="mdi-file-search-outline"
            :title="t('article_not_found')"
        >
            <v-btn
                color="primary"
                variant="tonal"
                class="mt-6"
                @click="navigateTo('/')"
                >{{ t('cmd_home') }}</v-btn
            >
        </EmptyState>

        <!-- 正文图片预览 Lightbox -->
        <ImageLightbox
            v-model="lightboxVisible"
            :images="lightboxImages"
            :start="lightboxIndex"
        />

        <!-- 划词浮条：选中正文任意一段，贴着选区冒出解释 / 翻译 / 展开 -->
        <SelectionAskBar
            :model-value="askVisible"
            :text="askText"
            :anchor="askAnchor"
            :actions="askChips"
            @select="openAsk"
        />

        <!-- 划词结果面板：只读，主按钮是复制而不是「应用」 -->
        <AiAssistDialog
            v-model="askOpen"
            :actions="askActions"
            :initial-key="askKey"
            :source-text="askSource"
            :apply-label="t('ai_copy')"
            @apply="handleAskApply"
        />
    </v-container>
</template>

<style scoped>
    .toc-wrapper {
        padding: 16px 20px;
    }

    .toc-progress {
        height: 3px;
        border-radius: 2px;
        background: rgba(var(--v-theme-on-surface), 0.06);
        margin-bottom: 14px;
        overflow: hidden;
    }

    .toc-progress-bar {
        height: 100%;
        border-radius: 2px;
        background: linear-gradient(
            90deg,
            rgb(var(--v-theme-primary)),
            rgba(var(--v-theme-primary), 0.6)
        );
        transition: width 0.2s ease-out;
    }

    .toc-nav {
        position: relative;
        max-height: calc(100vh - 13rem);
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: rgba(var(--v-theme-on-surface), 0.12) transparent;
        padding-left: 16px;
    }

    .toc-nav::-webkit-scrollbar {
        width: 3px;
    }

    .toc-nav::-webkit-scrollbar-thumb {
        background: rgba(var(--v-theme-on-surface), 0.12);
        border-radius: 2px;
    }

    .toc-indicator {
        position: absolute;
        left: 0;
        width: 3px;
        border-radius: 2px;
        background: rgb(var(--v-theme-primary));
        transition:
            top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.25s ease;
    }

    .toc-item {
        font-size: 0.85rem;
        line-height: 1.6;
        padding: 5px 14px;
        margin: 1px 0;
        cursor: pointer;
        border-radius: 6px;
        color: rgba(var(--v-theme-on-surface), 0.45);
        letter-spacing: 0.01em;
        transition:
            color 0.2s ease,
            background-color 0.2s ease,
            transform 0.15s ease;
    }

    .toc-item:hover {
        color: rgb(var(--v-theme-on-surface));
        background: rgba(var(--v-theme-on-surface), 0.05);
        transform: translateX(2px);
    }

    .toc-active {
        color: rgb(var(--v-theme-primary)) !important;
        font-weight: 600;
        background: rgba(var(--v-theme-primary), 0.06);
    }

    .toc-active:hover {
        background: rgba(var(--v-theme-primary), 0.1);
    }

    .toc-level-1 {
        font-weight: 600;
        font-size: 0.9rem;
    }

    .toc-level-2 {
        padding-left: 10px;
    }

    .toc-level-3 {
        padding-left: 24px;
        font-size: 0.82rem;
    }

    .toc-level-4 {
        padding-left: 36px;
        font-size: 0.8rem;
    }
</style>

<style>
    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6 {
        margin: 1em 0;
    }

    .markdown-body h1 {
        font-size: 2rem;
        font-weight: 600;
    }
    .markdown-body h2 {
        font-size: 1.75rem;
        font-weight: 600;
    }
    .markdown-body h3 {
        font-size: 1.5rem;
        font-weight: 500;
    }
    .markdown-body h4 {
        font-size: 1.25rem;
        font-weight: 500;
    }
    .markdown-body h5 {
        font-size: 1.1rem;
        font-weight: 500;
    }
    .markdown-body h6 {
        font-size: 1rem;
        font-weight: 500;
        color: #666;
    }

    .markdown-body p {
        font-size: 1.05rem;
        line-height: 1.7;
    }

    .markdown-body p {
        margin: 1em 0;
    }

    .markdown-body ul,
    .markdown-body ol {
        padding-left: 2em;
        margin: 1em 0;
    }

    .markdown-body li {
        margin: 0.5em 0;
    }

    .markdown-body blockquote {
        margin: 1em 0;
        padding: 0.5em 1em;
        color: #555;
        border-left: 4px solid #eaecef;
    }

    .markdown-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
    }

    .markdown-body th,
    .markdown-body td {
        border: 1px solid #ddd;
        padding: 0.5em 1em;
        text-align: left;
    }

    .markdown-body th {
    }

    .markdown-body img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1em 0;
        cursor: zoom-in;
    }

    .markdown-body pre {
        position: relative;
        padding: 1em;
        border-radius: 5px;
        overflow: auto;
    }

    .code-copy-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 6px;
        background: rgba(128, 128, 128, 0.18);
        color: #8b8b8b;
        font-size: 1rem;
        cursor: pointer;
        opacity: 0.7;
        transition:
            opacity 0.2s ease,
            background-color 0.2s ease,
            color 0.2s ease;
    }

    .code-copy-btn:hover {
        opacity: 1;
        background: rgba(128, 128, 128, 0.32);
    }

    .code-copy-btn.code-copied {
        opacity: 1;
        color: #4caf50;
    }

    .markdown-body pre code {
        background: none;
        padding: 0;
        border-radius: 0;
    }

    .markdown-body code {
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'Maple Mono CN SemiBold', sans-serif;
        font-size: 1.02rem;
        line-height: 1.7;
    }

    .markdown-body a {
        text-decoration: none;
    }

    .markdown-body a:hover {
        text-decoration: underline;
    }
</style>
