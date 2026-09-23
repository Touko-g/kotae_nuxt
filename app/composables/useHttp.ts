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

// 客户端共享的“正在进行的刷新” Promise，用于合并并发 401 的刷新请求
// 仅在浏览器端使用，避免 SSR 下跨请求状态泄漏
let pendingRefresh: Promise<boolean> | null = null

export const useHttp = () => {
    const config = useRuntimeConfig()
    const { show } = useSnackbar()
    const { t } = useLocale()

    const isRefresh = useState('isRefresh', () => false)
    const refreshCount = useState('refreshCount', () => 0)

    const loadingCount = ref(0) // 并发安全 loading
    const loading = computed(() => loadingCount.value > 0)

    // 执行一次 token 刷新；成功返回 true。并发时由多个请求共享同一调用
    const runRefresh = async (): Promise<boolean> => {
        const tokenCookie = useCookie('token')
        const refreshCookie = useCookie('refresh')
        const userCookie = useCookie('user')
        const { refresh, isLogin } = useAuth()
        if (!refreshCookie.value) return false
        isRefresh.value = true
        try {
            const data = await refresh({ refresh: refreshCookie.value })
            tokenCookie.value = data.access
            // 后端未轮换 refresh token 时 data.refresh 为空，避免误清空
            if (data.refresh) refreshCookie.value = data.refresh
            isLogin.value = true
            refreshCount.value += 1
            return true
        } catch (e) {
            tokenCookie.value = null
            refreshCookie.value = null
            userCookie.value = null
            isLogin.value = false
            return false
        } finally {
            isRefresh.value = false
        }
    }

    const request = async <T>(
        url: string,
        options: HttpOptions = {},
        allowRetry = true
    ) => {
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
                onResponseError({ response }) {
                    // 仅负责错误提示；401 的 token 刷新与重试交由外层 catch
                    if (response.status === 500) {
                        show(response.statusText, 'error')
                    } else if (response.status !== 401) {
                        const data = response._data
                        const showText = Object.values(data)[0]?.toString()
                        show(showText || response.statusText, 'error')
                    }
                },
            })
        } catch (err: any) {
            const tokenCookie = useCookie('token')
            const refreshCookie = useCookie('refresh')
            const userCookie = useCookie('user')
            const { isLogin } = useAuth()
            const isRefreshCall = url.includes('/refresh')
            // verify 接口：token 放在 body 里由其自身判定有效性，
            // 其 401 是“token 已过期”的正常答案，不触发刷新重发，交由调用方决定
            const isVerifyCall = url.includes('/verify')
            const status = err?.status

            // refresh 接口自身 401：登录态彻底失效，清理凭据并跳首页
            if (isRefreshCall && status === 401) {
                tokenCookie.value = null
                refreshCookie.value = null
                userCookie.value = null
                isLogin.value = false
                show(t('auth_expired'), 'error')
                navigateTo('/')
                throw new HttpError(t('auth_expired'), status)
            }

            // 普通请求 401：刷新一次 token 后重发原请求（仅重试一次）
            // 并发时共享同一次刷新，避免除首个外的请求直接失败导致页面空数据
            if (
                allowRetry &&
                !isVerifyCall &&
                status === 401 &&
                refreshCookie.value
            ) {
                let refreshed: boolean
                if (import.meta.client) {
                    if (!pendingRefresh) {
                        pendingRefresh = runRefresh().finally(() => {
                            pendingRefresh = null
                        })
                    }
                    refreshed = await pendingRefresh
                } else {
                    refreshed = await runRefresh()
                }
                if (refreshed) return await request<T>(url, options, false)
            }

            const message =
                err?.data?.message || err?.message || t('unknown_error')
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

    return {
        loading,
        request,
        get,
        post,
        put,
        del,
        tryRefresh: runRefresh,
    }
}
