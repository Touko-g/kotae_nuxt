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
    const { show } = useSnakebar()
    const { extractText } = useExtractText()

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

    const handleLike = async () => {
        if (!isLogin.value) return
        try {
            await addLike({ article: article.value?.id })
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

    onMounted(() => {
        if (article.value) {
            article.value.content = DOMPurify.sanitize(
                highlightCodeInHtml(article.value.content, name.value)
            )
            triggerRef(article)
        }
    })
</script>

<template>
    <v-card v-if="article" variant="text" class="pa-2 pa-sm-8">
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
                        <span>{{ fromNow(article.create_time) }}</span
                        ><span class="mx-2">|</span>
                        <span>{{ t('view') }}:{{ article.views }}</span
                        ><span v-if="!mobile" class="mx-2">|</span>
                        <span v-if="!mobile"
                            >{{ t('comment') }}:{{ article.comments }}</span
                        >
                    </div>
                </div>
            </div>
        </v-card-title>
        <v-card-text class="mt-4">
            <h2 class="text-4xl my-2">
                {{ article.title }}
            </h2>
            <div>
                <!-- eslint-disable vue/no-v-html -->
                <div class="markdown-body" v-html="article.content"></div>
                <div class="d-sm-flex align-center mt-6">
                    <h3 class="text-grey text-capitalize text-xl mr-2">
                        {{ t('tag') }}:
                    </h3>
                    <v-chip-group active-class="primary--text" column>
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
                <div class="d-flex justify-space-between">
                    <div class="d-flex">
                        <v-btn
                            variant="text"
                            icon="mdi-comment-outline"
                        ></v-btn>
                        <span>{{ article.comments }}</span>
                    </div>
                    <div class="d-flex">
                        <v-btn
                            v-if="
                                article.public && article.owner.id === user?.id
                            "
                            v-permission
                            icon="mdi-circle-edit-outline"
                            variant="text"
                            @click="handleEdit"
                        />

                        <v-btn
                            v-if="
                                article.public && article.owner.id === user?.id
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
</template>

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
        padding: 1em;
        border-radius: 5px;
        overflow: auto;
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
