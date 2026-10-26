/**
 * AI 接口的公共底座：地址拼接 + 鉴权头 + 错误归一化。
 *
 * 迁移到 Django 之后，`/api/ai/*` 不再由 Nitro 代理，而是直接打到后端，
 * 所以这里必须自己带上 JWT（原来同源请求不需要）。
 */

export interface AiErrorInfo {
    message: string
    /** 机器可读的错误码，如 ai_key_missing / ai_key_invalid */
    code: string
    status?: number
}

export const useAiClient = () => {
    const config = useRuntimeConfig()
    const token = useCookie<string | null>('token')

    /** apiBase 末尾有斜杠，path 开头也可能有，统一收口成一个斜杠 */
    const url = (path: string) =>
        `${String(config.public.apiBase || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

    const headers = (extra: Record<string, string> = {}) => ({
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
        ...extra,
    })

    const isLogin = computed(() => !!token.value)
    const enabled = computed(() => config.public.aiEnabled !== false)
    /** AI 入口是否可用：既要没被站点开关关掉，也要已登录 */
    const available = computed(() => enabled.value && isLogin.value)

    return { url, headers, isLogin, enabled, available }
}

/** 把后端 {detail, code} 或 FetchError 归一成可展示的错误 */
export const parseAiError = (
    err: any,
    fallback = 'AI 请求失败'
): AiErrorInfo => {
    const data = err?.data ?? err
    return {
        message: data?.detail || data?.message || err?.message || fallback,
        code: data?.code || 'ai_error',
        status: data?.status ?? err?.status,
    }
}
