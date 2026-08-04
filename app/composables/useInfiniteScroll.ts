import type { Ref } from 'vue'

interface UseInfiniteScrollOptions {
    pageSize?: number
    rootMargin?: string
}

export function useInfiniteScroll<T>(
    fetchFn: (page: number) => Promise<{ results: T[]; count: number }>,
    options: UseInfiniteScrollOptions = {}
) {
    const { pageSize = 10, rootMargin = '100px' } = options

    const items = ref<T[]>([]) as Ref<T[]>
    const loading = ref(false)
    const currentPage = ref(1)
    const pageCount = ref(0)
    const scrollRef = useTemplateRef<HTMLElement>('scrollRef')
    const observer = ref<IntersectionObserver | null>(null)

    const initItems = (data: { results: T[]; count: number }) => {
        items.value = data.results
        pageCount.value = Math.ceil(data.count / pageSize)
    }

    const resetPage = () => {
        currentPage.value = 1
        pageCount.value = 0
    }

    const loadMore = async () => {
        if (loading.value || currentPage.value >= pageCount.value) return
        loading.value = true
        currentPage.value++
        const { results } = await fetchFn(currentPage.value)
        if (results?.length) {
            items.value.push(...results)
        }
        loading.value = false
    }

    const observeScroll = () => {
        if (scrollRef.value && observer.value) {
            observer.value.observe(scrollRef.value)
        }
    }

    onMounted(async () => {
        observer.value = new IntersectionObserver(
            async entries => {
                if (entries[0]?.isIntersecting) {
                    await loadMore()
                }
            },
            { rootMargin }
        )
        await nextTick()
        observeScroll()
    })

    onUnmounted(() => {
        observer.value?.disconnect()
    })

    return {
        items,
        loading,
        currentPage,
        pageCount,
        scrollRef,
        initItems,
        resetPage,
        loadMore,
        observeScroll,
    }
}
