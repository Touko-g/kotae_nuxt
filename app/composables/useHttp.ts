// 类型定义
export interface HttpOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers?: Record<string, string>
    params?: Record<string, any>
    body?: any
    showLoading?: boolean
}

export class HttpError extends Error {
    status?: number
    constructor(message: string, status?: number) {
        super(message)
        this.name = 'HttpError'
        this.status = status
    }
}

export const useHttp = () => {
    const config = useRuntimeConfig()
    const loadingCount = ref(0) // 并发安全 loading
    const loading = computed(() => loadingCount.value > 0)

    // 核心请求方法
    const request = async <T>(
        url: string,
        options: HttpOptions = {}
    ): Promise<T> => {
        if (options.showLoading) loadingCount.value++
        const token = useCookie('token')?.value

        try {
            return await $fetch<T>(url, {
                method: options.method || 'GET',
                headers: {
                    Authorization: token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                query: options.params,
                body: options.body,
                baseURL: config.public.apiBase,
                timeout: 10000,
            })
        } catch (err: any) {
            // 统一异常处理
            const message =
                err?.data?.message || err?.message || 'Unknown Error'
            const status = err?.status
            throw new HttpError(message, status)
        } finally {
            if (options.showLoading) loadingCount.value--
        }
    }

    // 快捷方法
    const get = <T>(
        url: string,
        params?: Record<string, any>,
        showLoading = false
    ) => request<T>(url, { method: 'GET', params, showLoading })

    const post = <T>(url: string, body?: any, showLoading = false) =>
        request<T>(url, { method: 'POST', body, showLoading })

    const put = <T>(url: string, body?: any, showLoading = false) =>
        request<T>(url, { method: 'PUT', body, showLoading })

    const del = <T>(
        url: string,
        params?: Record<string, any>,
        showLoading = false
    ) => request<T>(url, { method: 'DELETE', params, showLoading })

    return { loading, request, get, post, put, del }
}
