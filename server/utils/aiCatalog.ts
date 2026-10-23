import type { AiModelInfo } from '#shared/types/ai'

/**
 * 内置模型清单。
 *
 * 为什么需要兜底：DashScope 的 OpenAI 兼容模式并不稳定提供 `/models` 列表接口
 * （文档里只给了「模型列表」的网页页签）。`/api/ai/models` 会先试上游接口，
 * 拿不到就用这份清单，保证模型选择框永远有内容。
 *
 * 加模型时注意：这里只放**对话模型**。rerank / embedding / tts 走
 * chat/completions 会直接 502（见 NON_CHAT_HINTS）。
 */
export const AI_MODEL_CATALOG: AiModelInfo[] = [
    {
        id: 'qwen-flash',
        label: 'qwen-flash',
        desc: '快而便宜，日常写作够用',
        recommended: true,
    },
    { id: 'qwen-plus', label: 'qwen-plus', desc: '能力与成本均衡' },
    { id: 'qwen-max', label: 'qwen-max', desc: '质量最好，速度慢一些' },
    { id: 'qwen-long', label: 'qwen-long', desc: '超长上下文' },
    { id: 'qwen-turbo', label: 'qwen-turbo', desc: '极速，适合短文本' },
    { id: 'qwen3.8-max', label: 'qwen3.8-max', desc: '新一代旗舰' },
]

/** 命中这些关键词的是向量 / 重排 / 语音 / 图像模型，不能走 chat/completions */
const NON_CHAT_HINTS = [
    'rerank',
    'embedding',
    'embed',
    'tts',
    'asr',
    'paraformer',
    'sambert',
    'cosyvoice',
    'sensevoice',
    'wanx',
    'stable-diffusion',
    'ocr',
]

export const isChatModel = (id: string) => {
    const lower = id.toLowerCase()
    return !NON_CHAT_HINTS.some(hint => lower.includes(hint))
}

/**
 * 把上游返回的 id 映射成列表项：认识的带上内置文案，不认识的只显示 id。
 * 上游能连上就以上游为准（它才是这个账号真实可用的集合），
 * 所以内置清单里多出来的条目不会强行塞进来。
 */
export const mergeWithCatalog = (ids: string[]): AiModelInfo[] => {
    const seen = new Set<string>()
    const models: AiModelInfo[] = []

    for (const id of ids) {
        if (!id || seen.has(id)) continue
        seen.add(id)
        models.push(
            AI_MODEL_CATALOG.find(item => item.id === id) ?? { id, label: id }
        )
    }

    return models
}
