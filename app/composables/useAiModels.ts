import type {
    AiCredentialInfo,
    AiModelInfo,
    AiModelList,
    AiQuotaInfo,
} from '#shared/types/ai'

/**
 * 模型列表 / 额度 / 凭据 / 模型选择。
 *
 * 迁移后这四个接口都在 Django 侧，且都要求登录：
 * - `GET  /api/ai/credential/`：当前用户是否已配 Key（只回掩码）
 * - `PUT  /api/ai/credential/`：保存或更新（key 留空表示沿用旧值）
 * - `GET  /api/ai/models/`：可选模型（上游拿不到时回落到内置清单）
 * - `GET  /api/ai/quota/`：当前用户自己的用量
 *
 * 选择结果仍存 cookie：SSR 也能读到，不会先渲染默认值再跳一下。
 */

const MODEL_COOKIE = 'ai_model'
const MODEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 180

export const useAiModels = () => {
    const client = useAiClient()

    const models = ref<AiModelInfo[]>([])
    const source = ref<'upstream' | 'builtin'>('builtin')
    const defaultModel = ref('')
    const loading = ref(false)
    const error = ref<string | null>(null)

    /** 当前用户的凭据状态 */
    const credential = ref<AiCredentialInfo | null>(null)
    const credentialLoading = ref(false)
    /** 已配置且启用：决定要不要真的去请求模型/额度 */
    const configured = computed(
        () =>
            !!credential.value?.configured &&
            credential.value?.enabled !== false
    )

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

    const loadCredential = async () => {
        if (!client.available.value) return
        credentialLoading.value = true
        try {
            credential.value = await $fetch<AiCredentialInfo>(
                client.url('ai/credential/'),
                { headers: client.headers() }
            )
        } catch {
            // 拿不到凭据状态不该挡住整个面板，按「未配置」处理
            credential.value = null
        } finally {
            credentialLoading.value = false
        }
    }

    const load = async () => {
        if (!client.available.value || loading.value) return
        if (!configured.value) return
        loading.value = true
        error.value = null
        try {
            const res = await $fetch<AiModelList>(client.url('ai/models/'), {
                headers: client.headers(),
            })
            models.value = res.models
            source.value = res.source
            defaultModel.value = res.default
        } catch (err: any) {
            // 模型列表拉不到不该挡住使用：退回服务端默认模型即可
            error.value = parseAiError(err, 'failed to load models').message
        } finally {
            loading.value = false
        }
    }

    const loadQuota = async () => {
        if (!client.available.value || quotaLoading.value) return
        if (!configured.value) return
        quotaLoading.value = true
        try {
            quota.value = await $fetch<AiQuotaInfo>(client.url('ai/quota/'), {
                headers: client.headers(),
            })
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
        available: client.available,
        models,
        source,
        defaultModel,
        selected,
        loading,
        error,
        quota,
        quotaLoading,
        credential,
        credentialLoading,
        configured,
        load,
        loadQuota,
        loadCredential,
        formatTokens,
    }
}
