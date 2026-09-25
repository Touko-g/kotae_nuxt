<script setup lang="ts">
    const { t, current } = useLocale()

    useSeoMeta({
        title: computed(() => t('archive_title')),
        ogTitle: computed(() => t('archive_title')),
        description: computed(() => t('archive_sub')),
    })

    const { getArticleList } = useArticle()
    const { format, create } = useDayjs()

    const { data } = await useAsyncData('archive', () =>
        getArticleList({ pagesize: 10000, order: '-create_time' })
    )

    // 数据已按 create_time 倒序，按 YYYY-MM 归并即保持「新→旧」的月份顺序
    const groups = computed(() => {
        const list = data.value?.results ?? []
        const map = new Map<string, { key: string; items: Article[] }>()
        for (const article of list) {
            const key = format(article.create_time, 'YYYY-MM')
            if (!map.has(key)) map.set(key, { key, items: [] })
            map.get(key)!.items.push(article)
        }
        return [...map.values()]
    })

    const totalArticles = computed(() => data.value?.count ?? 0)

    // 折叠面板默认展开最近一个月
    const openPanels = ref<number[]>([0])

    // 分组标题随语言切换：中文「2026 年 9 月」，英文「September 2026」
    const monthLabel = (key: string) => {
        const [year, month] = key.split('-')
        return current.value === 'zh'
            ? `${year} 年 ${Number(month)} 月`
            : create(`${key}-01`).format('MMMM YYYY')
    }

    const gotoArticle = (id: number) => {
        navigateTo(`/article/${id}`)
    }
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
        <header class="page-hero anim anim-slide-down">
            <p class="page-hero__eyebrow">✦ Kotae</p>
            <h1 class="text-h4 page-hero__title">
                <span class="k-gradient-text">{{ t('archive_title') }}</span>
                <span
                    class="page-hero__deco page-hero__deco--a"
                    aria-hidden="true"
                ></span>
            </h1>
            <p class="page-hero__sub">{{ t('archive_sub') }}</p>
            <p v-if="totalArticles" class="archive__meta">
                {{ t('archive_stats', [totalArticles, groups.length]) }}
            </p>
        </header>

        <v-card v-if="groups.length" class="k-card anim anim-up pa-2 pa-sm-4">
            <v-expansion-panels
                v-model="openPanels"
                multiple
                flat
                variant="accordion"
            >
                <v-expansion-panel
                    v-for="(group, index) in groups"
                    :key="group.key"
                    :value="index"
                    elevation="0"
                >
                    <v-expansion-panel-title class="archive__panel-title">
                        <span class="archive__month">{{
                            monthLabel(group.key)
                        }}</span>
                        <span class="archive__badge">{{
                            group.items.length
                        }}</span>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <div class="archive__list">
                            <button
                                v-for="article in group.items"
                                :key="article.id"
                                type="button"
                                class="archive__item"
                                :lang="current"
                                @click="gotoArticle(article.id)"
                            >
                                <span class="archive__date">{{
                                    format(article.create_time, 'MM-DD')
                                }}</span>
                                <span class="archive__name">{{
                                    article.title
                                }}</span>
                            </button>
                        </div>
                    </v-expansion-panel-text>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-card>
        <EmptyState
            v-else
            icon="mdi-calendar-blank-outline"
            :title="t('archive_empty')"
        />
    </v-container>
</template>

<style scoped>
    .archive__meta {
        margin-top: 0.5rem;
        font-size: 0.85rem;
        font-weight: 700;
        color: rgba(var(--v-theme-on-surface), 0.55);
    }

    .archive__panel-title {
        padding: 0.5rem 0.75rem;
    }

    .archive__month {
        font-weight: 800;
        font-size: 1.05rem;
        color: rgba(var(--v-theme-on-surface), 0.85);
    }

    .archive__badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.6em;
        height: 1.6em;
        padding: 0 0.5em;
        margin-left: 0.6rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--k-accent-a) 16%, transparent);
        color: var(--k-accent-a);
        font-size: 0.75rem;
        font-weight: 800;
    }

    .archive__list {
        display: flex;
        flex-direction: column;
    }

    .archive__item {
        display: flex;
        align-items: baseline;
        gap: 0.9rem;
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: none;
        border-radius: 10px;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: rgba(var(--v-theme-on-surface), 0.82);
        transition:
            background-color 0.2s ease,
            color 0.2s ease,
            transform 0.2s ease;
    }

    .archive__item:hover,
    .archive__item:focus-visible {
        background: color-mix(in srgb, var(--k-accent-a) 10%, transparent);
        color: var(--k-accent-a);
        transform: translateX(4px);
    }

    .archive__date {
        flex: none;
        font-variant-numeric: tabular-nums;
        font-size: 0.82rem;
        font-weight: 700;
        color: rgba(var(--v-theme-on-surface), 0.45);
    }

    .archive__name {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-weight: 600;
    }
</style>
