import type {
    AiChatOptions,
    AiChatResult,
    AiMessage,
    AiStreamEvent,
    AiUsage,
} from '#shared/types/ai'

export interface UseAIOptions {
    /** 默认模型，如 qwen3.8-flash / qwen-max / qwen-long */
    model?: string
    /** 默认系统提示词（人设 / 输出格式约束） */
    system?: string
    temperature?: number
    maxTokens?: number
    /** 是否把每轮问答写进 history，默认 true；关掉就是纯一次性调用 */
    keepHistory?: boolean
    /** 每收到一个增量片段回调（流式专用） */
    onDelta?: (delta: string, full: string) => void
    onDone?: (result: AiChatResult) => void
    onError?: (message: string) => void
}

/** 把字符串或消息数组统一成消息数组 */
const toMessages = (input: string | AiMessage[]): AiMessage[] =>
    typeof input === 'string'
        ? [{ role: 'user', content: input }]
        : input.map(item => ({ role: item.role, content: item.content }))

/**
 * 对话能力（后端代理，API Key 存在服务端并加密，永远不下发到浏览器）
 *
 * 鉴权：请求带登录后的 JWT，后端据此取当前用户自己的 Key。
 * 未配置 Key 时后端返回 400 + code=ai_key_missing，`needKey` 会置位，
 * 面板据此引导用户去设置。
 *
 * ```ts
 * const ai = useAI({ system: '你是中文写作助手' })
 * await ai.askStream('帮我润色：……')          // 流式，内容进 ai.content
 * const res = await ai.ask('给这篇文章起 5 个标题') // 非流式，直接拿返回值
 * ```
 */
export const useAI = (options: UseAIOptions = {}) => {
    const client = useAiClient()

    const history = ref<AiMessage[]>([])
    /** 最近一次回复内容（流式时逐字累积） */
    const content = ref('')
    const usage = ref<AiUsage | null>(null)
    const error = ref<string | null>(null)
    /** 后端错误码：ai_key_missing / ai_key_invalid 时 UI 引导去配置 */
    const errorCode = ref<string | null>(null)
    const pending = ref(false)
    const streaming = ref(false)
    const busy = computed(() => pending.value || streaming.value)
    /** 当前用户还没配 Key */
    const needKey = computed(() => errorCode.value === 'ai_key_missing')

    let controller: AbortController | null = null

    const withSystem = (messages: AiMessage[]): AiMessage[] =>
        options.system
            ? [{ role: 'system', content: options.system }, ...messages]
            : messages

    const buildBody = (messages: AiMessage[], opts: AiChatOptions) => ({
        messages,
        model: opts.model ?? options.model,
        temperature: opts.temperature ?? options.temperature,
        maxTokens: opts.maxTokens ?? options.maxTokens,
        topP: opts.topP,
        extra: opts.extra,
    })

    const commit = (
        result: AiChatResult,
        incoming: AiMessage[]
    ): AiChatResult => {
        content.value = result.content
        usage.value = result.usage ?? null
        if (options.keepHistory !== false) {
            history.value = [
                ...history.value,
                ...incoming,
                { role: 'assistant', content: result.content },
            ]
        }
        options.onDone?.(result)
        return result
    }

    const fail = (message: string, code = 'ai_error') => {
        error.value = message
        errorCode.value = code
        options.onError?.(message)
        return null
    }

    /** 清空上下文与状态 */
    const clear = () => {
        history.value = []
        content.value = ''
        usage.value = null
        error.value = null
        errorCode.value = null
    }

    /** 中断进行中的请求（流式会保留已生成的部分） */
    const abort = () => controller?.abort()

    /** 非流式：一次性拿完整回复，适合摘要 / 标题这类短输出 */
    const ask = async (
        input: string | AiMessage[],
        opts: AiChatOptions = {}
    ): Promise<AiChatResult | null> => {
        if (busy.value) return null

        error.value = null
        errorCode.value = null
        pending.value = true
        controller = new AbortController()

        const incoming = toMessages(input)
        try {
            const result = await $fetch<AiChatResult>(client.url('ai/chat/'), {
                method: 'POST',
                headers: client.headers({
                    'Content-Type': 'application/json',
                }),
                body: buildBody(
                    withSystem([...history.value, ...incoming]),
                    opts
                ),
                signal: controller.signal,
            })
            return commit(result, incoming)
        } catch (err: any) {
            // 用 signal 判定是否为主动中断：$fetch 的中断错误会被包装成
            // FetchError（AbortError 在 cause 里），直接看 name 判不准
            if (controller?.signal.aborted) return null
            const info = parseAiError(err)
            return fail(info.message, info.code)
        } finally {
            pending.value = false
            controller = null
        }
    }

    /** 流式：逐字回调 onDelta，结束后返回完整结果 */
    const askStream = async (
        input: string | AiMessage[],
        opts: AiChatOptions = {}
    ): Promise<AiChatResult | null> => {
        if (busy.value) return null

        error.value = null
        errorCode.value = null
        streaming.value = true
        content.value = ''
        controller = new AbortController()

        const incoming = toMessages(input)
        let acc = ''
        let model = opts.model ?? options.model ?? ''
        let finalUsage: AiUsage | null = null
        let finishReason: string | null = null
        let aborted = false

        try {
            const res = await fetch(client.url('ai/chat-stream/'), {
                method: 'POST',
                headers: client.headers({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify(
                    buildBody(withSystem([...history.value, ...incoming]), opts)
                ),
                signal: controller.signal,
            })

            if (!res.ok || !res.body) {
                const info = await readErrorResponse(res)
                throw Object.assign(new Error(info.message), {
                    aiCode: info.code,
                })
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

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
                        if (!raw) continue

                        let evt: AiStreamEvent
                        try {
                            evt = JSON.parse(raw)
                        } catch {
                            continue
                        }

                        if (evt.type === 'delta') {
                            acc += evt.content
                            content.value = acc
                            options.onDelta?.(evt.content, acc)
                        } else if (evt.type === 'done') {
                            model = evt.model || model
                            finalUsage = evt.usage ?? null
                            finishReason = evt.finishReason ?? null
                        } else if (evt.type === 'error') {
                            throw new Error(evt.message)
                        }
                    }
                }
            }
        } catch (err: any) {
            // 主动中断：保留已生成内容，不当作错误
            if (controller?.signal.aborted) {
                aborted = true
            } else {
                return fail(
                    err?.message || 'AI 请求失败',
                    err?.aiCode || 'ai_error'
                )
            }
        } finally {
            streaming.value = false
            controller = null
        }

        const result: AiChatResult = {
            content: acc,
            model,
            usage: finalUsage,
            finishReason,
        }

        // 中断的半截回答不写进上下文，避免下一轮拿残句当历史
        if (aborted) {
            usage.value = finalUsage
            return result
        }

        return commit(result, incoming)
    }

    return {
        available: client.available,
        history,
        content,
        usage,
        error,
        errorCode,
        needKey,
        pending,
        streaming,
        busy,
        ask,
        askStream,
        abort,
        clear,
    }
}

/** 非 2xx 时从响应体里取后端给出的文案与错误码 */
const readErrorResponse = async (
    res: Response
): Promise<{ message: string; code: string }> => {
    try {
        const data = await res.json()
        return {
            message: data?.detail || data?.message || res.statusText,
            code: data?.code || 'ai_error',
        }
    } catch {
        return {
            message: res.statusText || `AI request failed (${res.status})`,
            code: 'ai_error',
        }
    }
}
