import type { AiModelInfo, AiModelList, AiQuotaInfo } from '#shared/types/ai'

/**
 * 模型列表 / 额度 / 模型选择。
 *
 * 三个接口各管一件事：
 * - `GET /api/ai/models`：可选模型（上游拿不到时回落到内置清单）
 * - `GET /api/ai/quota`：本站自己的用量统计（官方额度没有 API，给控制台外链）
 * - 选择结果存 cookie：SSR 也能读到，不会先渲染默认值再跳一下
 */

const MODEL_COOKIE = 'ai_model'
const MODEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 180

export const useAiModels = () => {
    const config = useRuntimeConfig()
    const available = computed(() => config.public.aiEnabled !== false)

    const models = ref<AiModelInfo[]>([])
    const source = ref<'upstream' | 'builtin'>('builtin')
    const defaultModel = ref('')
    const loading = ref(false)
    const error = ref<string | null>(null)

    const modelCookie = useCookie<string | null>(MODEL_COOKIE, {
        maxAge: MODEL_COOKIE_MAX_AGE,
        sameSite: 'lax',
    })

    /**
     * 当前模型：cookie 里选的优先，否则用服务端默认。
     * 选了一个不在列表里的模型（比如服务端换了默认）时仍然生效，
     * 免得因为列表还没加载完就把用户的选择清掉。
     */
    const selected = computed<string>({
        get: () => modelCookie.value || defaultModel.value,
        set: value => {
            modelCookie.value = value || null
        },
    })

    const quota = ref<AiQuotaInfo | null>(null)
    const quotaLoading = ref(false)

    const load = async () => {
        if (!available.value || loading.value) return
        loading.value = true
        error.value = null
        try {
            const res = await $fetch<AiModelList>('/api/ai/models')
            models.value = res.models
            source.value = res.source
            defaultModel.value = res.default
        } catch (err: any) {
            // 模型列表拉不到不该挡住使用：退回服务端默认模型即可
            error.value =
                err?.statusMessage || err?.message || 'failed to load models'
        } finally {
            loading.value = false
        }
    }

    const loadQuota = async () => {
        if (!available.value || quotaLoading.value) return
        quotaLoading.value = true
        try {
            quota.value = await $fetch<AiQuotaInfo>('/api/ai/quota')
        } catch {
            // 用量只是参考信息，失败就不显示
            quota.value = null
        } finally {
            quotaLoading.value = false
        }
    }

    /** 大数字压成 1.2k / 3.4M，面板里放得下 */
    const formatTokens = (value: number) => {
        if (!value) return '0'
        if (value < 1000) return String(value)
        if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`
        return `${(value / 1_000_000).toFixed(1)}M`
    }

    return {
        available,
        models,
        source,
        defaultModel,
        selected,
        loading,
        error,
        quota,
        quotaLoading,
        load,
        loadQuota,
        formatTokens,
    }
}
