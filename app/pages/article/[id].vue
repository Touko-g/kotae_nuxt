<script setup lang="ts">
    import DOMPurify from 'dompurify'
    import type { ConfirmDialog } from '#components'
    const route = useRoute()

    const { getArticle, delArticle } = useArticle()
    const { getLikeList, addLike } = useLike()

    const { fromNow } = useDayjs()
    const { t } = useLocale()
    const { mobile } = useDisplay()
    const { name } = useTheme()
    const { show } = useSnackbar()
    const { extractText } = useExtractText()
    const { soundSparkle, soundTick } = useSound()

    const highlighter = await useShiki()
    const refreshCount = useState('refreshCount')
    const isLogin = useState('isLogin')
    const user = useCookie<User>('user')

    const confirmRef = ref<InstanceType<typeof ConfirmDialog>>()

    // 安全获取 id
    const id = String(route.params.id ?? '')

    // 服务器端渲染加载
    const { data: article } = await useAsyncData(
        'article',
        () => getArticle(id),
        { watch: [refreshCount] }
    )

    const { data: like } = await useAsyncData(
        'like',
        () => getLikeList({ article: id, pagesize: 10000 }),
        { watch: [refreshCount] }
    )

    if (article.value) {
        const title = article.value.title
        const description = extractText(article.value.content).slice(0, 160)
        const url = `https://kotae.cn/article/${article.value.id}`

        useSeoMeta({
            title,
            ogTitle: title,
            description,
            ogDescription: description,
            ogType: 'article',
            ogUrl: url,
        })

        useHead({
            script: [
                {
                    type: 'application/ld+json',
                    innerHTML: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'BlogPosting',
                        headline: title,
                        description,
                        author: {
                            '@type': 'Person',
                            name: article.value.owner.username,
                        },
                        datePublished: article.value.create_time,
                        dateModified: article.value.update_time,
                        mainEntityOfPage: {
                            '@type': 'WebPage',
                            '@id': url,
                        },
                    }),
                },
            ],
        })
    }

    /**
     * 替换 HTML 字符串中的 <pre><code class="language-xxx">...</code></pre> 为高亮代码
     * @param html 原始 HTML 内容
     * @param themeName
     */
    const highlightCodeInHtml = (html: string, themeName: string) => {
        return html.replace(
            /<pre(?:\s+class="language-(\w+)")?>\s*<code[^>]*?>([\s\S]*?)<\/code>\s*<\/pre>/g,
            (_, lang = 'text', code) => {
                // 反转义 HTML 实体
                const decoded = code
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')

                // 如果传入的lang不支持，默认用 javascript 处理
                const realLang = highlighter.getLoadedLanguages().includes(lang)
                    ? lang
                    : 'javascript'
                return highlighter.codeToHtml(decoded, {
                    lang: realLang,
                    theme:
                        themeName === 'light' ? 'github-light' : 'github-dark',
                })
            }
        )
    }

    const handleEdit = () => {
        if (!isLogin.value) return
        navigateTo(`/article/edit/${id}`)
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

    const handleLike = async () => {
        if (!isLogin.value) return
        try {
            await addLike({ article: article.value?.id })
            soundSparkle()
            // 重触发心跳动画
            likePop.value = false
            await nextTick()
            likePop.value = true
            setTimeout(() => (likePop.value = false), 560)
            if (typeof refreshCount.value === 'number') {
                refreshCount.value += 1
            }
        } catch (e) {}
    }

    const isLike = computed(() => {
        if (like.value?.results && user.value) {
            const userId = user.value.id
            return like.value.results.some(item => item.user_info.id === userId)
        }
        return false
    })

    // --- TOC 目录导航 ---
    interface TocItem {
        id: string
        text: string
        level: number
    }
    const toc = ref<TocItem[]>([])
    const activeId = ref('')
    const progress = ref(0)
    const indicator = reactive({ top: 0, height: 0 })
    const markdownRef = useTemplateRef<HTMLElement>('markdownRef')
    const tocNavRef = useTemplateRef<HTMLElement>('tocNavRef')
    let headingEls: HTMLElement[] = []

    const buildToc = () => {
        const container = markdownRef.value
        if (!container) return
        const headings = container.querySelectorAll('h1, h2, h3, h4')
        const items: TocItem[] = []
        headings.forEach((el, i) => {
            const id = `heading-${i}`
            el.id = id
            items.push({
                id,
                text: el.textContent?.trim() || '',
                level: Number(el.tagName[1]),
            })
        })
        toc.value = items.filter(item => item.text)
        headingEls = Array.from(headings) as HTMLElement[]
    }

    // 指示条跟随 + 目录自动滚动
    watch(activeId, id => {
        const nav = tocNavRef.value
        if (!nav) return
        const el = nav.querySelector<HTMLElement>(`[data-toc-id="${id}"]`)
        if (!el) return
        indicator.top = el.offsetTop
        indicator.height = el.offsetHeight
        // 保持活动项在目录可视区域内
        const navRect = nav.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        if (elRect.top < navRect.top || elRect.bottom > navRect.bottom) {
            nav.scrollTo({
                top: el.offsetTop - nav.clientHeight / 2,
                behavior: 'smooth',
            })
        }
    })

    // 滚动：进度 + 标题高亮
    const HEADING_OFFSET = 120
    const onScroll = () => {
        const doc = document.documentElement
        const scrollTop = doc.scrollTop
        const total = doc.scrollHeight - doc.clientHeight
        progress.value = total > 0 ? (scrollTop / total) * 100 : 0

        // 找到最后一个 top <= scrollTop + offset 的标题
        let current = ''
        for (const el of headingEls) {
            if (el.offsetTop <= scrollTop + HEADING_OFFSET) {
                current = el.id
            } else {
                break
            }
        }
        if (current && current !== activeId.value) {
            activeId.value = current
        }
    }

    const scrollToHeading = (id: string) => {
        activeId.value = id
        const el = document.getElementById(id)
        if (!el) return
        const APPBAR_HEIGHT = 80
        const top =
            el.getBoundingClientRect().top + window.scrollY - APPBAR_HEIGHT
        window.scrollTo({ top, behavior: 'smooth' })
    }

    // --- 代码块一键复制 ---
    const COPY_ICON = '<i class="mdi mdi-content-copy"></i>'
    const COPIED_ICON = '<i class="mdi mdi-check"></i>'

    // 为正文中每个 <pre> 注入复制按钮（幂等，可重复调用）
    const enhanceCodeBlocks = () => {
        const container = markdownRef.value
        if (!container) return
        container.querySelectorAll('pre').forEach(pre => {
            if (pre.querySelector(':scope > .code-copy-btn')) return
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'code-copy-btn'
            btn.setAttribute('title', t('copy_code'))
            btn.innerHTML = COPY_ICON
            pre.appendChild(btn)
        })
    }

    // 事件委托处理复制，避免逐个按钮绑监听
    const onCodeCopy = async (e: Event) => {
        const node = e.target as Element
        const btn = node?.closest?.('.code-copy-btn')
        if (!btn) return
        const code =
            btn.closest('pre')?.querySelector('code')?.textContent ?? ''
        try {
            await navigator.clipboard.writeText(code)
        } catch (err) {
            // 兼容非安全上下文的降级方案
            const ta = document.createElement('textarea')
            ta.value = code
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            ta.remove()
        }
        btn.classList.add('code-copied')
        btn.innerHTML = COPIED_ICON
        soundTick()
        window.setTimeout(() => {
            btn.classList.remove('code-copied')
            btn.innerHTML = COPY_ICON
        }, 1500)
    }

    onMounted(() => {
        if (article.value) {
            article.value.content = DOMPurify.sanitize(
                highlightCodeInHtml(article.value.content, name.value)
            )
            triggerRef(article)
            nextTick(() => {
                buildToc()
                enhanceCodeBlocks()
            })
        }
        markdownRef.value?.addEventListener('click', onCodeCopy)
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
    })

    onUnmounted(() => {
        markdownRef.value?.removeEventListener('click', onCodeCopy)
        window.removeEventListener('scroll', onScroll)
    })
</script>

<template>
    <v-container class="px-4 px-sm-6 py-6 py-sm-10">
        <v-row v-if="article">
            <!-- 主内容 -->
            <v-col :cols="toc.length && !mobile ? 9 : 12">
                <v-card variant="text">
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
                                </div>
                            </div>
                        </div>
                    </v-card-title>
                    <v-card-text class="mt-4">
                        <h2 class="text-4xl my-4 leading-tight tracking-tight">
                            {{ article.title }}
                        </h2>
                        <div>
                            <!-- eslint-disable vue/no-v-html -->
                            <div
                                ref="markdownRef"
                                class="markdown-body"
                                v-html="article.content"
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
                                        icon="mdi-thumb-up-outline"
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
                                        v-if="article.likes"
                                        :class="isLike && 'text-primary'"
                                        >{{ article.likes }}</span
                                    >
                                </div>
                            </div>
                        </div>
                        <ArticleComment :article="article.id" />
                    </v-card-text>
                    <ConfirmDialog ref="confirmRef" />
                </v-card>
            </v-col>

            <!-- TOC 目录 -->
            <v-col v-if="toc.length && !mobile" cols="3">
                <div class="toc-wrapper sticky top-[5.5rem]">
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
