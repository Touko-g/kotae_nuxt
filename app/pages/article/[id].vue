<script setup lang="ts">
    import DOMPurify from 'dompurify'
    import ArticleComment from '~/components/ArticleComment.vue'
    const route = useRoute()
    const { getArticle } = useArticle()
    const { fromNow } = useDayjs()
    const { t } = useLocale()
    const { mobile } = useDisplay()
    const { name } = useTheme()
    const highlighter = await useShiki()
    const refreshCount = useState('refreshCount')

    // 安全获取 id
    const id = String(route.params.id ?? '')

    // 服务器端渲染加载
    const { data: article } = await useLazyAsyncData(
        'article',
        () => getArticle(id),
        { watch: [refreshCount] }
    )

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

    // 动态标题
    watchEffect(() => {
        if (article.value?.title) {
            useSeoMeta({
                title: article.value.title,
                ogTitle: article.value.title,
            })
        }
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
                <v-btn size="60" icon variant="flat">
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
            <div class="text-4xl">
                {{ article.title }}
            </div>
            <div>
                <v-divider class="my-2" color="surface" />
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
                <v-divider class="my-2" color="surface" />
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
                            v-permission
                            icon="mdi-circle-edit-outline"
                            variant="text"
                        >
                        </v-btn>
                        <v-btn icon="mdi-trash-can-outline" variant="text">
                        </v-btn>
                        <v-btn icon="mdi-thumb-up-outline" variant="text" />
                    </div>
                </div>
            </div>
            <ArticleComment :article="article.id" />
        </v-card-text>
    </v-card>
</template>

<style>
    .markdown-body {
    }

    .markdown-body h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
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
