/**
 * AI 能力层的公共类型：前端 composable 与 Nitro 服务端共用
 * （Nuxt 4 的 shared/ 目录，两端都可通过 `#shared/types/ai` 引用）
 */

/** 对话角色，与 OpenAI / DashScope 兼容模式一致 */
export type AiRole = 'system' | 'user' | 'assistant'

export interface AiMessage {
    role: AiRole
    content: string
}

/** token 用量（上游未返回时为 undefined） */
export interface AiUsage {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

export interface AiChatOptions {
    /** 覆盖服务端默认模型，如 qwen3.8-flash / qwen-max / qwen-long */
    model?: string
    temperature?: number
    topP?: number
    maxTokens?: number
    /** 系统提示词，服务端会拼到 messages 最前面 */
    system?: string
    /** 透传给上游的额外参数，如 { enable_search: true } 开启联网搜索 */
    extra?: Record<string, unknown>
}

/** 非流式返回结果 */
export interface AiChatResult {
    content: string
    model: string
    usage?: AiUsage | null
    finishReason?: string | null
}

/** 请求体（/api/ai/chat/ 与 /api/ai/chat-stream/ 共用） */
export interface AiChatRequest extends AiChatOptions {
    messages: AiMessage[]
}

/** 流式事件：服务端把上游 SSE 归一化成这三种类型 */
export type AiStreamEvent =
    | { type: 'delta'; content: string }
    | {
          type: 'done'
          model?: string
          usage?: AiUsage | null
          finishReason?: string | null
      }
    | { type: 'error'; message: string }

/** AI 辅助面板里的一个动作：按钮文案 + 实际发给模型的提示词 */
export interface AiAssistAction {
    key: string
    label: string
    icon: string
    prompt: string
    /**
     * 结果格式：
     * - `html`：富文本（文章排版），面板按 HTML 预览，应用时插进编辑器
     * - `text`：纯文本（标题、评论），默认值
     */
    format?: 'text' | 'html'
}

/** 可选模型（列表项） */
export interface AiModelInfo {
    id: string
    label: string
    /** 一句话定位，如「快而便宜」 */
    desc?: string
    /** 内置清单里的推荐项 */
    recommended?: boolean
}

/** GET /api/ai/models/ */
export interface AiModelList {
    models: AiModelInfo[]
    /**
     * 数据来源：
     * - `upstream`：上游 `/models` 真实返回
     * - `builtin`：上游没有这个接口（DashScope 兼容模式就不稳定提供），用内置清单兜底
     */
    source: 'upstream' | 'builtin'
    /** 服务端默认模型（runtimeConfig.aiModel） */
    default: string
}

/** 单日用量统计 */
export interface AiUsageDay {
    date: string
    requests: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
    byModel: Record<string, { requests: number; totalTokens: number }>
}

/** GET /api/ai/quota/ */
export interface AiQuotaInfo {
    today: AiUsageDay
    /** 最近若干天合计 */
    total: { days: number; requests: number; totalTokens: number }
    /**
     * 官方免费额度能不能通过 API 查：DashScope 只提供控制台页面，没有公开接口，
     * 所以这里是 false。不要把它当成「额度充足」的意思。
     */
    officialAvailable: boolean
    /** 百炼控制台的免费额度页面，前端直接给个外链 */
    consoleUrl: string
}

/**
 * 用户自己的 API Key 配置状态（GET /api/ai/credential/）
 *
 * 后端只返回掩码，明文与密文都不会出现在响应里；
 * `needs_reentry` 表示库里的密文已解不开（通常是 SECRET_KEY 变更），需要重填。
 */
export interface AiCredentialInfo {
    configured: boolean
    enabled: boolean
    /** 形如 sk-1******abcd */
    api_key_masked: string
    base_url: string
    default_model: string
    update_time: string | null
    needs_reentry?: boolean
}

/** PUT /api/ai/credential/ 入参；api_key 留空表示沿用已保存的 key */
export interface AiCredentialInput {
    api_key?: string
    base_url?: string
    default_model?: string
    enabled?: boolean
}
