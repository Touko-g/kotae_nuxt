/**
 * 滚动加载下一页。
 *
 * 之前 index / search / article/like / user/photo 各自抄了一份完全一样的实现：
 * 一个 IntersectionObserver + loading 标志 + `Math.ceil(count / pagesize)`。
 * 抄四遍的后果是四份都有各自的小毛病（有的加载失败后 loading 永远为 true，
 * 有的忘记把页码退回）。这里收成一份：
 *
 * ```ts
 * const { items: articles, loading, hasMore, scrollRef } = useInfiniteList({
 *     pagesize: 10,
 *     initial: () => data.value?.recent,   // 首屏来自 useApiData
 *     fetchPage: page => getArticleList({ page, order: '-create_time' }),
 * })
 * ```
 *
 * 模板里把 `ref="scrollRef"` 挂到列表底部的哨兵元素上即可。
 */

export interface InfinitePage<T> {
    results: T[]
    count: number
}

export interface UseInfiniteListOptions<T, R extends InfinitePage<T>> {
    /** 取第 page 页（从 1 开始） */
    fetchPage: (page: number) => Promise<R>
    /** 每页条数：把后端 count 换算成总页数用 */
    pagesize?: number
    /** 首屏数据（一般来自 useApiData 的 data）。变化时整个列表重置回第一页 */
    initial?: () => R | undefined
    /** 哨兵提前多少距离开始加载 */
    rootMargin?: string
}

export const useInfiniteList = <T, R extends InfinitePage<T> = InfinitePage<T>>(
    options: UseInfiniteListOptions<T, R>
) => {
    const { fetchPage, pagesize = 10, initial, rootMargin = '100px' } = options

    const items = ref<T[]>([]) as Ref<T[]>
    const loading = ref(false)
    const page = ref(1)
    const totalPages = ref(0)

    const scrollRef = useTemplateRef<HTMLElement>('scrollRef')
    const observer = ref<IntersectionObserver | null>(null)

    const hasMore = computed(() => page.value < totalPages.value)

    /** 首屏数据到手（或换成另一批）后重置：页码归 1，条数与总页数一起对齐 */
    const sync = (data?: R) => {
        if (!data?.results) return
        items.value = data.results
        page.value = 1
        totalPages.value = Math.ceil(data.count / pagesize)
    }

    if (initial) watch(initial, sync, { immediate: true })

    const loadMore = async () => {
        if (loading.value || !hasMore.value) return
        loading.value = true
        page.value += 1
        try {
            const res = await fetchPage(page.value)
            if (res?.results?.length) items.value.push(...res.results)
            // 翻页过程中 count 可能变（别人删了文章），以最新一次为准
            totalPages.value = Math.ceil(res.count / pagesize)
        } catch {
            // 页码退回，否则这一页会被永久跳过
            page.value -= 1
        } finally {
            loading.value = false
        }
    }

    const observe = () => {
        const el = scrollRef.value
        if (!el || !observer.value) return
        observer.value.observe(el)
    }

    onMounted(async () => {
        observer.value = new IntersectionObserver(
            entries => {
                if (entries[0]?.isIntersecting) loadMore()
            },
            { rootMargin }
        )
        await nextTick()
        observe()
    })

    // 列表从空变非空时哨兵才被渲染出来，这时候需要补挂一次
    watch(items, async () => {
        await nextTick()
        observe()
    })

    onUnmounted(() => observer.value?.disconnect())

    return { items, loading, page, totalPages, hasMore, scrollRef, loadMore }
}
