import type { H3Event } from 'h3'
import { recordAiUsage } from './aiUsage'
import type {
    AiChatOptions,
    AiChatResult,
    AiMessage,
    AiRole,
    AiStreamEvent,
    AiUsage,
} from '#shared/types/ai'

/** 允许透传给上游的角色白名单，防止前端塞入非法 role */
const ALLOWED_ROLES: AiRole[] = ['system', 'user', 'assistant']

/** 单条消息内容上限（字符），避免有人整篇长文灌进来刷 token */
const MAX_CONTENT_LENGTH = 24000

/** 单次请求消息条数上限，超出时只保留最近的若干条 */
const MAX_MESSAGES = 40

/** 限流表的键数量超过该值时触发一次过期清理，防止内存无界增长 */
const RATE_TABLE_SOFT_LIMIT = 5000

export interface AiConfig {
    apiKey: string
    /** OpenAI 兼容模式的基础地址，末尾不带斜杠 */
    baseUrl: string
    model: string
    temperature: number
    maxTokens: number
    /** 上游请求超时（毫秒） */
    timeout: number
    /** 每个 IP 在窗口内允许的请求数，0 表示不限流 */
    rateLimit: number
    rateWindow: number
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

const toNumber = (value: unknown, fallback: number) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

/**
 * 读取 AI 相关配置；缺少密钥时直接抛 503，
 * 让前端能明确区分「没配」和「调失败」
 */
export const getAiConfig = (event?: H3Event): AiConfig => {
    const config = useRuntimeConfig(event)
    const apiKey = String(config.aiApiKey || '')

    if (!apiKey) {
        throw createError({
            statusCode: 503,
            statusMessage: 'AI service is not configured',
        })
    }

    return {
        apiKey,
        baseUrl: String(
            config.aiBaseUrl ||
                'https://dashscope.aliyuncs.com/compatible-mode/v1'
        ).replace(/\/+$/, ''),
        model: String(config.aiModel || 'qwen-flash'),
        temperature: clamp(toNumber(config.aiTemperature, 0.7), 0, 2),
        maxTokens: clamp(toNumber(config.aiMaxTokens, 2048), 1, 8192),
        timeout: clamp(toNumber(config.aiTimeout, 60000), 5000, 300000),
        rateLimit: Math.max(0, toNumber(config.aiRateLimit, 20)),
        rateWindow: Math.max(1000, toNumber(config.aiRateWindow, 60000)),
    }
}

/** 把前端传来的 messages 归一化成上游可接受的结构 */
export const normalizeMessages = (input: unknown): AiMessage[] => {
    if (!Array.isArray(input)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'messages must be an array',
        })
    }

    const messages = input
        .filter(item => item && typeof item === 'object')
        .map(item => {
            const raw = item as Record<string, unknown>
            const role = ALLOWED_ROLES.includes(raw.role as AiRole)
                ? (raw.role as AiRole)
                : 'user'
            const content = typeof raw.content === 'string' ? raw.content : ''
            return { role, content: content.slice(0, MAX_CONTENT_LENGTH) }
        })
        .filter(item => item.content.trim().length > 0)

    if (!messages.length) {
        throw createError({
            statusCode: 400,
            statusMessage: 'messages must not be empty',
        })
    }

    // 超长对话只保留最近的部分，system 提示词单独补在最前面
    return messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages
}

/** 把 system 提示词补到最前面；messages 已自带 system 时以调用方为准 */
const withSystemPrompt = (
    messages: AiMessage[],
    system?: string
): AiMessage[] => {
    const prompt =
        typeof system === 'string'
            ? system.trim().slice(0, MAX_CONTENT_LENGTH)
            : ''
    if (!prompt || messages[0]?.role === 'system') return messages
    return [{ role: 'system', content: prompt }, ...messages]
}

/** 组装发给上游的请求体（stream 决定是否流式） */
const buildUpstreamBody = (
    messages: AiMessage[],
    options: AiChatOptions,
    config: AiConfig,
    stream: boolean
) => {
    const body: Record<string, unknown> = {
        model: options.model || config.model,
        messages: withSystemPrompt(messages, options.system),
        temperature: clamp(
            toNumber(
                options.temperature ?? config.temperature,
                config.temperature
            ),
            0,
            2
        ),
        max_tokens: clamp(
            Math.round(
                toNumber(
                    options.maxTokens ?? config.maxTokens,
                    config.maxTokens
                )
            ),
            1,
            8192
        ),
        stream,
    }

    if (options.topP != null) {
        body.top_p = clamp(toNumber(options.topP, 0.8), 0, 1)
    }

    // 流式时要求上游在最后一个分片带上 usage
    if (stream) {
        body.stream_options = { include_usage: true }
    }

    // 透传参数放最后，允许覆盖上面的默认值（如 enable_search）
    if (options.extra && typeof options.extra === 'object') {
        Object.assign(body, options.extra)
    }

    return body
}

const mapUsage = (usage: any): AiUsage | null => {
    if (!usage || typeof usage !== 'object') return null
    return {
        promptTokens: toNumber(usage.prompt_tokens, 0),
        completionTokens: toNumber(usage.completion_tokens, 0),
        totalTokens: toNumber(usage.total_tokens, 0),
    }
}

/** 把上游错误体压成一行可读文案，避免整段 HTML 塞进 statusMessage */
const readUpstreamError = async (res: Response) => {
    const text = await res.text().catch(() => '')
    try {
        const json = JSON.parse(text)
        return (
            json?.error?.message ||
            json?.message ||
            json?.code ||
            text.slice(0, 300) ||
            res.statusText
        )
    } catch {
        return text.slice(0, 300) || res.statusText
    }
}

const callUpstream = async (
    config: AiConfig,
    body: Record<string, unknown>,
    signal: AbortSignal
) => {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
    })

    if (!res.ok) {
        const detail = await readUpstreamError(res)

        // 「免费额度用完即停」是账号状态而不是代码问题：单独给 402，
        // 让前端能直接提示去控制台处理，而不是笼统报「上游错误」
        if (/FreeTierOnly|AllocationQuota/i.test(detail)) {
            throw createError({
                statusCode: 402,
                statusMessage:
                    'AI free quota exhausted (AllocationQuota.FreeTierOnly) — 免费额度已用尽，请到百炼控制台关闭「免费额度用完即停」或充值',
            })
        }

        throw createError({
            statusCode: 502,
            statusMessage: `AI upstream error: ${detail}`,
        })
    }

    return res
}

/**
 * 非流式对话：一次性拿到完整回复
 * 上游或网络异常统一转成 502，密钥缺失由 getAiConfig 抛 503
 */
export const requestChatCompletion = async (
    event: H3Event,
    messages: AiMessage[],
    options: AiChatOptions = {}
): Promise<AiChatResult> => {
    const config = getAiConfig(event)
    const res = await callUpstream(
        config,
        buildUpstreamBody(messages, options, config, false),
        AbortSignal.timeout(config.timeout)
    )

    const json: any = await res.json().catch(() => null)
    const choice = json?.choices?.[0]
    const result: AiChatResult = {
        content: choice?.message?.content ?? '',
        model: json?.model ?? options.model ?? config.model,
        usage: mapUsage(json?.usage),
        finishReason: choice?.finish_reason ?? null,
    }

    // 记账不阻塞响应：写盘失败最多丢一条统计
    recordAiUsage(result.model, result.usage ?? null)

    return result
}

/**
 * 流式对话：把上游 SSE 归一化成 { type: 'delta' | 'done' | 'error' } 事件流
 * 前端只需要认这一套协议，换模型供应商时改这里即可
 */
export const streamChatCompletion = async (
    event: H3Event,
    messages: AiMessage[],
    options: AiChatOptions = {}
): Promise<ReadableStream<Uint8Array>> => {
    const config = getAiConfig(event)
    const abort = new AbortController()

    // 客户端断开（关标签页 / abort）时同步取消上游请求，避免继续计费
    const onClose = () => abort.abort()
    event.node?.res?.once?.('close', onClose)

    let upstream: Response
    try {
        upstream = await callUpstream(
            config,
            buildUpstreamBody(messages, options, config, true),
            abort.signal
        )
    } catch (err) {
        event.node?.res?.off?.('close', onClose)
        throw err
    }

    const reader = upstream.body!.getReader()
    const encoder = new TextEncoder()
    const model = String(options.model || config.model)

    const encode = (payload: AiStreamEvent) =>
        encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            const decoder = new TextDecoder()
            let buffer = ''
            let usage: AiUsage | null = null
            let finishReason: string | null = null

            const emit = (payload: AiStreamEvent) => {
                try {
                    controller.enqueue(encode(payload))
                } catch {
                    // 流已被客户端关闭，忽略
                }
            }

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const blocks = buffer.split('\n\n')
                    buffer = blocks.pop() ?? ''

                    for (const block of blocks) {
                        for (const line of block.split('\n')) {
                            if (!line.startsWith('data:')) continue
                            const raw = line.slice(5).trim()
                            if (!raw || raw === '[DONE]') continue

                            let chunk: any
                            try {
                                chunk = JSON.parse(raw)
                            } catch {
                                continue
                            }

                            const choice = chunk?.choices?.[0]
                            const delta = choice?.delta?.content
                            if (typeof delta === 'string' && delta) {
                                emit({ type: 'delta', content: delta })
                            }
                            if (choice?.finish_reason) {
                                finishReason = choice.finish_reason
                            }
                            if (chunk?.usage) {
                                usage = mapUsage(chunk.usage)
                            }
                        }
                    }
                }

                emit({ type: 'done', model, usage, finishReason })
                // 流式同样要记账：usage 来自最后一个分片（stream_options.include_usage）
                recordAiUsage(model, usage)
            } catch (err: any) {
                // 客户端主动 abort 不算错误，安静收尾
                if (!abort.signal.aborted) {
                    emit({
                        type: 'error',
                        message: err?.message || 'AI upstream interrupted',
                    })
                }
            } finally {
                event.node?.res?.off?.('close', onClose)
                try {
                    controller.close()
                } catch {
                    // 已关闭
                }
            }
        },
        cancel() {
            abort.abort()
            reader.cancel().catch(() => {})
        },
    })
}

// ---------------------------------------------------------------------------
// 简易内存限流：单实例 node-server 下足够用；多实例部署请换 Redis 之类的共享存储
// ---------------------------------------------------------------------------

const rateHits = new Map<string, { count: number; resetAt: number }>()

const pruneRateTable = (now: number) => {
    for (const [key, hit] of rateHits) {
        if (hit.resetAt <= now) rateHits.delete(key)
    }
}

/** 按 IP 限流，超限抛 429；limit <= 0 表示关闭 */
export const assertAiRateLimit = (event: H3Event, config: AiConfig) => {
    if (config.rateLimit <= 0) return

    const ip =
        getRequestIP(event, { xForwardedFor: true }) ||
        event.node?.req?.socket?.remoteAddress ||
        'unknown'
    const now = Date.now()
    const hit = rateHits.get(ip)

    if (!hit || hit.resetAt <= now) {
        if (rateHits.size > RATE_TABLE_SOFT_LIMIT) pruneRateTable(now)
        rateHits.set(ip, { count: 1, resetAt: now + config.rateWindow })
        return
    }

    hit.count += 1
    if (hit.count > config.rateLimit) {
        const retryAfter = Math.ceil((hit.resetAt - now) / 1000)
        setResponseHeader(event, 'Retry-After', retryAfter)
        throw createError({
            statusCode: 429,
            statusMessage: `Too many AI requests, retry in ${retryAfter}s`,
        })
    }
}
