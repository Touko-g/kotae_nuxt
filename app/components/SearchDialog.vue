<script setup lang="ts">
    import { useDebounce } from '~/composables/useDebounce'

    const { t } = useLocale()
    const { getSearchList, addSearch } = useSearch()
    const { getArticleList } = useArticle()
    const { fromNow } = useDayjs()
    const searchDialog = useState('search', () => false)

    const search = reactive({
        show: false,
        topShow: true,
        searchValue: '',
        results: [] as Article[],
        radioGroup: 'title',
        radios: ['title', 'content', 'tag', 'author'],
        tops: [] as Tag[],
        loading: false,
    })

    watch(searchDialog, async value => {
        if (value) {
            try {
                const { results } = await getSearchList({
                    order: '-hot',
                    pagesize: 5,
                })
                search.tops = results
            } catch (e) {}
        }
    })

    watch(
        () => search.results.length,
        value => {
            search.topShow = value === 0
        }
    )

    watch(
        () => search.radioGroup,
        async value => {
            if (search.searchValue.length) {
                try {
                    search.loading = true
                    const { results } = await getArticleList({
                        [value]: search.searchValue,
                        pagesize: 5,
                    })
                    search.results = results
                } catch (e) {
                } finally {
                    search.loading = false
                }
            }
        }
    )

    const jumpToSearch = (v: string) => {
        navigateTo({
            path: '/search',
            query: {
                query: v,
                type: search.radioGroup,
            },
        })

        searchDialog.value = false
    }

    const goDetail = (v: Article) => {
        navigateTo(`/article/${v.id}`)
        searchDialog.value = false
    }

    // ✅ 核心防抖逻辑
    const { run: debounceSearch, cancel } = useDebounce(
        async (searchInfo: string) => {
            if (searchInfo?.length) {
                try {
                    search.loading = true
                    const { results } = await getArticleList({
                        [search.radioGroup]: searchInfo,
                        pagesize: 5,
                    })
                    await addSearch({ name: searchInfo })
                    search.results = results
                } catch (e) {
                } finally {
                    search.loading = false
                }
            } else {
                search.results.length = 0
            }
        },
        500
    )

    const handleClear = () => {
        cancel()
        search.results = []
        search.searchValue = ''
        search.topShow = true
    }

    const { topShow, searchValue, results, radioGroup, radios, tops, loading } =
        toRefs(search)
</script>

<template>
    <v-dialog
        v-model="searchDialog"
        max-width="900"
        transition="dialog-bottom-transition"
        @after-leave="handleClear"
    >
        <v-card>
            <!-- 标题区域 -->
            <v-card-title
                class="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6"
            >
                <div>
                    <span class="font-semibold text-lg mr-3">
                        {{ t('search_by') }}:
                    </span>
                    <v-radio-group
                        v-model="radioGroup"
                        density="compact"
                        inline
                        class="mt-2 sm:mt-0"
                    >
                        <v-radio
                            v-for="(radio, index) in radios"
                            :key="index"
                            color="primary"
                            class="mx-2 uppercase text-sm"
                            :label="radio"
                            :value="radio"
                        />
                    </v-radio-group>
                </div>
            </v-card-title>

            <!-- 内容区域 -->
            <v-card-text class="px-6 pb-6 pt-4">
                <!-- 搜索框 -->
                <v-text-field
                    v-model.trim="searchValue"
                    :label="t('search_article')"
                    density="comfortable"
                    variant="outlined"
                    clearable
                    :loading="loading"
                    class="mb-5"
                    :hint="`by ${radioGroup}`"
                    @update:model-value="debounceSearch"
                />

                <!-- 顶部标题与按钮 -->
                <div class="flex justify-between items-center mb-3">
                    <p class="uppercase tracking-wide text-sm font-semibold">
                        {{
                            topShow
                                ? t('top_search')
                                : t('search_list_about') + ' : ' + searchValue
                        }}
                    </p>
                    <v-btn
                        v-show="!topShow"
                        variant="text"
                        size="small"
                        color="primary"
                        class="hover:underline"
                        @click="jumpToSearch(searchValue)"
                    >
                        {{ t('view_all') }}
                    </v-btn>
                </div>

                <v-divider class="my-4 opacity-80" />

                <!-- 动画切换 -->
                <transition name="fade-slide" mode="out-in">
                    <!-- 🔥 Top Search -->
                    <div v-if="topShow" key="top">
                        <v-list variant="flat" class="rounded-lg">
                            <v-list-item
                                v-for="(top, index) in tops"
                                :key="top.id"
                                :value="top"
                                class="rounded-lg transition-all duration-200 cursor-pointer"
                                @click="jumpToSearch(top.name)"
                            >
                                <template #prepend>
                                    <v-icon
                                        :icon="`mdi-numeric-${index + 1}`"
                                        color="primary"
                                        size="28"
                                    />
                                </template>
                                <v-list-item-title class="font-medium">
                                    {{ top.name }}
                                </v-list-item-title>
                                <template #append>
                                    <v-icon
                                        icon="mdi-fire"
                                        color="red"
                                        size="18"
                                    />
                                    <span
                                        class="text-xs w-6 ml-1 text-gray-500"
                                    >
                                        {{ top.hot }}
                                    </span>
                                </template>
                            </v-list-item>
                        </v-list>
                    </div>

                    <!-- 🔍 Search Results -->
                    <div v-else key="results">
                        <v-list variant="flat" class="rounded-lg">
                            <v-list-item
                                v-for="(i, index) in results"
                                :key="i.id"
                                :value="i"
                                class="rounded-lg transition-all duration-200 cursor-pointer"
                                @click="goDetail(i)"
                            >
                                <template #prepend>
                                    <v-icon
                                        :icon="`mdi-numeric-${index + 1}`"
                                        color="primary"
                                        size="28"
                                    />
                                </template>
                                <v-list-item-title class="font-medium">
                                    {{ i.title }}
                                </v-list-item-title>
                                <template #append>
                                    <span class="text-sm">{{
                                        i?.owner?.username
                                    }}</span>
                                    <v-divider
                                        vertical
                                        class="mx-2"
                                        opacity="0.4"
                                    />
                                    <span class="text-xs">{{
                                        fromNow(i.create_time)
                                    }}</span>
                                </template>
                            </v-list-item>
                        </v-list>
                    </div>
                </transition>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<style scoped>
    /* 动画：淡入淡出 + 向上滑动 */
    .fade-slide-enter-active,
    .fade-slide-leave-active {
        transition: all 0.3s ease;
    }

    .fade-slide-enter-from {
        opacity: 0;
        transform: translateY(10px);
    }

    .fade-slide-leave-to {
        opacity: 0;
        transform: translateY(-10px);
    }
</style>
