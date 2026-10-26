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

/**
 * 自定义提示词的作用场景。
 * 两处上下文不一样（文章是富文本 + 有标题，评论是纯文本草稿），
 * 所以配置分开存，互不干扰。
 */
export type AiPromptScope = 'article' | 'comment'

/** 提示词模板里可用的占位符名（对应 `AiPromptVars` 的四个键） */
export type AiPromptVarName = 'text' | 'title' | 'reply' | 'article'

/** 提示词模板里可用的变量 */
export interface AiPromptVars {
    /** 选中的原文 / 输入框里的草稿 */
    text?: string
    /** 文章标题 */
    title?: string
    /**
     * 回复场景的上下文：对方是谁、说了什么。
     * 只有「帮我回一条」用得上 —— 它必须在运行时才知道回的是哪条评论，
     * 不能固化进模板，否则每条回复都会带着同一条旧评论。
     */
    reply?: string
    /**
     * 文章正文摘要（纯文本，已截断）。
     * 评论场景里「帮我写一条」拿它当素材；用户自定义动作想引用正文也用它。
     */
    article?: string
}

/** 结果格式：html 会进富文本管线，text 按纯文本处理 */
export type AiActionFormat = 'text' | 'html'

/**
 * 内置动作的最小描述。
 * 提示词配置面板只认这几个字段，所以由调用方把 i18n key 解成 label 再传进来 ——
 * 面板本身不掺业务知识。
 */
export interface AiBuiltinAction {
    key: string
    label: string
    icon: string
    format: AiActionFormat
    /**
     * 编辑面板的预填模板，`{{text}}` 标出原文的位置。
     * 运行时才知道的内容用变量占位（如 `{{reply}}` 代表「对方说了什么」），
     * 不能把某一次的具体内容固化进模板。
     */
    defaultTemplate?: string
    /**
     * 这个动作运行时**真的有值**的占位符，配置面板据此只显示能用的 chip。
     *
     * 不声明就按 `['text', 'title']` 处理。之所以由调用方给：只有它知道
     * 自己往 `AiPromptVars` 里填了什么 —— 比如「帮我写一条」不读草稿、
     * 只读正文，那 `{{text}}` 摆在那里就是个陷阱（写进去永远是空串）。
     */
    vars?: AiPromptVarName[]
}

/** 用户自己新增的一个动作 */
export interface AiCustomPrompt {
    id: string
    /** 菜单里显示的名字，用户自己起 */
    name: string
    /** mdi 图标名 */
    icon: string
    /** 提示词模板，支持 {{text}} / {{title}} */
    prompt: string
    /** 结果格式：html 会进富文本管线，text 按纯文本处理 */
    format: AiActionFormat
    enabled: boolean
}

/** 单个场景的提示词配置 */
export interface AiPromptConfig {
    /** 覆盖内置动作：内置 key -> 模板；缺省或空串表示继续用内置默认提示词 */
    overrides: Record<string, string>
    /** 用户新增的动作，追加在内置动作之后 */
    customs: AiCustomPrompt[]
}

/** 完整配置（按场景分组），整体存在 localStorage 里 */
export type AiPromptStore = Record<AiPromptScope, AiPromptConfig>

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
