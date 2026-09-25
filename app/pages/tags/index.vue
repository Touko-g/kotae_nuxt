<script setup lang="ts">
    const { t, current } = useLocale()

    useSeoMeta({
        title: computed(() => t('tag_cloud')),
        ogTitle: computed(() => t('tag_cloud')),
        description: computed(() => t('tags_sub')),
    })

    const { getTagList } = useTag()

    const { data } = await useAsyncData('tag-cloud', () =>
        getTagList({ name: '', pagesize: 1000, order: '-hot' })
    )

    // 按热度降序，等距分桶为 5 档字号，用 class 表达权重（避免内联 style）
    const sizeBuckets = [
        'tag-cloud--xs',
        'tag-cloud--sm',
        'tag-cloud--md',
        'tag-cloud--lg',
        'tag-cloud--xl',
    ]

    const tags = computed(() => {
        const list = [...(data.value?.results ?? [])].sort(
            (a, b) => b.hot - a.hot
        )
        const n = list.length
        return list.map((tag, index) => {
            const bucket =
                n <= 1
                    ? sizeBuckets.length - 1
                    : Math.round(
                          (1 - index / (n - 1)) * (sizeBuckets.length - 1)
                      )
            return { ...tag, sizeClass: sizeBuckets[bucket] }
        })
    })

    const gotoTag = (name: string) => {
        navigateTo({ path: '/search', query: { query: name, type: 'tag' } })
    }
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
        <header class="page-hero anim anim-slide-down">
            <p class="page-hero__eyebrow">✦ Kotae</p>
            <h1 class="text-h4 page-hero__title">
                <span class="k-gradient-text">{{ t('tag_cloud') }}</span>
                <span
                    class="page-hero__deco page-hero__deco--a"
                    aria-hidden="true"
                ></span>
            </h1>
            <p class="page-hero__sub">{{ t('tags_sub') }}</p>
        </header>

        <v-card class="k-card anim anim-up">
            <v-card-text class="pa-5 pa-sm-8">
                <div
                    v-if="tags.length"
                    class="tag-cloud d-flex flex-wrap ga-3 ga-sm-4 align-center justify-center"
                >
                    <button
                        v-for="tag in tags"
                        :key="tag.id"
                        type="button"
                        class="tag-cloud__item"
                        :class="tag.sizeClass"
                        :lang="current"
                        :aria-label="tag.name"
                        @click="gotoTag(tag.name)"
                    >
                        <span class="tag-cloud__name">{{ tag.name }}</span>
                        <span v-if="tag.hot" class="tag-cloud__count">{{
                            tag.hot
                        }}</span>
                    </button>
                </div>
                <EmptyState
                    v-else
                    icon="mdi-tag-multiple-outline"
                    :title="t('no_tags')"
                />
            </v-card-text>
        </v-card>
    </v-container>
</template>

<style scoped>
    .tag-cloud__item {
        display: inline-flex;
        align-items: baseline;
        gap: 0.35em;
        padding: 0.2em 0.7em;
        border: 2px solid color-mix(in srgb, var(--k-accent-a) 22%, transparent);
        border-radius: 14px;
        background: #fff;
        /* 贴纸恒为白底，正文用固定深墨，避免深色系主题下 on-surface 翻白导致白字白底 */
        color: #1d1a17;
        font-weight: 800;
        line-height: 1.35;
        cursor: pointer;
        box-shadow: 3px 4px 0
            color-mix(in srgb, var(--k-accent-a) 12%, transparent);
        transition:
            transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.25s ease,
            border-color 0.25s ease,
            color 0.25s ease;
    }

    .tag-cloud__item:hover,
    .tag-cloud__item:focus-visible {
        transform: translateY(-3px) rotate(-1.2deg);
        border-color: color-mix(in srgb, var(--k-accent-a) 55%, transparent);
        color: var(--k-accent-a);
        box-shadow:
            6px 9px 0 color-mix(in srgb, var(--k-accent-a) 18%, transparent),
            0 12px 24px -12px
                color-mix(in srgb, var(--k-accent-a) 45%, transparent);
    }

    .tag-cloud__count {
        font-size: 0.62em;
        font-weight: 700;
        color: rgba(29, 26, 23, 0.42);
    }

    /* 权重字号：xs → xl */
    .tag-cloud--xs {
        font-size: 0.85rem;
    }
    .tag-cloud--sm {
        font-size: 1rem;
    }
    .tag-cloud--md {
        font-size: 1.25rem;
    }
    .tag-cloud--lg {
        font-size: 1.6rem;
    }
    .tag-cloud--xl {
        font-size: 2.05rem;
    }

    /* 深色系下贴纸仍为白底深墨，仅借主题强调色描边，无需再覆盖文字色 */
    .v-theme--dark .tag-cloud__item,
    .v-theme--rainy .tag-cloud__item,
    .v-theme--glass .tag-cloud__item {
        border-color: color-mix(in srgb, var(--k-accent-a) 34%, transparent);
        box-shadow: 3px 4px 0
            color-mix(in srgb, var(--k-accent-a) 16%, transparent);
    }
</style>
