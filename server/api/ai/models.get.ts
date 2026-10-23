import type { AiModelList } from '#shared/types/ai'

/**
 * GET /api/ai/models —— 模型列表
 *
 * DashScope 兼容模式的 `/models` 不是稳定接口：能连上就用它返回的真实集合，
 * 连不上（404 / 超时 / 返回体不是 OpenAI 形状）就回落到内置清单，
 * 前端据 `source` 决定要不要提示「这是内置列表」。
 *
 * 结果缓存 10 分钟：模型集合不会秒变，而每次打开面板都探一次上游太浪费。
 */

const CACHE_TTL = 10 * 60 * 1000
/** 探测上游的超时：模型列表不值得让用户等太久 */
const PROBE_TIMEOUT = 4000

let cache: { at: number; value: AiModelList } | null = null

/** 返回可用的对话模型 id；上游不可用时返回 null（不是空数组） */
const fetchUpstreamModels = async (baseUrl: string, apiKey: string) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT)

    try {
        const res = await fetch(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal,
        })
        if (!res.ok) return null

        const json: any = await res.json().catch(() => null)
        const ids: string[] = (json?.data ?? [])
            .map((item: any) => String(item?.id ?? ''))
            .filter(Boolean)

        // 只留对话模型：向量 / 重排 / 语音模型混进选择框只会让人踩 502
        const chat = ids.filter(isChatModel)
        return chat.length ? chat : null
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

export default defineEventHandler(async event => {
    // 没配密钥直接 503，前端据此隐藏 AI 入口
    const config = getAiConfig(event)

    if (cache && Date.now() - cache.at < CACHE_TTL) return cache.value

    const ids = await fetchUpstreamModels(config.baseUrl, config.apiKey)
    const value: AiModelList = ids
        ? {
              models: mergeWithCatalog(ids),
              source: 'upstream',
              default: config.model,
          }
        : {
              models: AI_MODEL_CATALOG,
              source: 'builtin',
              default: config.model,
          }

    cache = { at: Date.now(), value }
    return value
})
