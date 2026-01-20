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
    const { show } = useSnakebar()

    const isRefresh = useState('isRefresh', () => false)
    const refreshCount = useState('refreshCount', () => 0)

    const loadingCount = ref(0) // 并发安全 loading
    const loading = computed(() => loadingCount.value > 0)

    const request = async <T>(url: string, options: HttpOptions = {}) => {
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
                onRequestError({ error }) {
                    show(error.message, 'error')
                },
                async onResponseError({ response }) {
                    const data = response._data
                    const token = useCookie('token')
                    const refreshToken = useCookie('refresh')
                    const user = useCookie('user')
                    const { refresh, isLogin } = useAuth()

                    // 避免 refresh 接口再次触发自身
                    if (response.url.includes('/refresh')) {
                        token.value = null
                        refreshToken.value = null
                        user.value = null
                        isLogin.value = false
                        show(
                            'Authorization expired, please log in again',
                            'error'
                        )
                        navigateTo('/')
                        return
                    }

                    if (response.status === 401 && refreshToken.value) {
                        if (isRefresh.value) {
                            return
                        }

                        try {
                            isRefresh.value = true
                            const data = await refresh({
                                refresh: refreshToken.value,
                            })
                            token.value = data.access
                            refreshToken.value = data.refresh
                            isLogin.value = true
                            refreshCount.value += 1
                        } catch (e) {
                            token.value = null
                            refreshToken.value = null
                            isLogin.value = false
                            user.value = null
                        } finally {
                            isRefresh.value = false
                        }
                    } else if (response.status === 500) {
                        show(response.statusText, 'error')
                    } else {
                        const showText = Object.values(data)[0]?.toString()

                        // 处理请求错误
                        show(showText || response.statusText, 'error')
                    }
                },
            })
        } catch (err: any) {
            const message =
                err?.data?.message || err?.message || 'Unknown Error'
            const status = err?.status
            throw new HttpError(message, status)
        } finally {
            if (options.showLoading) loadingCount.value--
        }
    }

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
