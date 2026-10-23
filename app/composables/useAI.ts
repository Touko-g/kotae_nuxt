import type {
    AiChatOptions,
    AiChatResult,
    AiMessage,
    AiStreamEvent,
    AiUsage,
} from '#shared/types/ai'

export interface UseAIOptions {
    /** 默认模型，如 qwen-flash / qwen-max / qwen-long */
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

/** 从 $fetch / createError 的错误对象里抠出可读文案 */
const toErrorMessage = (err: any): string =>
    err?.data?.statusMessage ||
    err?.data?.message ||
    err?.statusMessage ||
    err?.message ||
    'AI request failed'

/**
 * Qwen 对话能力（服务端代理，密钥不下发到浏览器）
 *
 * ```ts
 * const ai = useAI({ system: '你是中文写作助手' })
 * await ai.askStream('帮我润色：……')          // 流式，内容进 ai.content
 * const res = await ai.ask('给这篇文章起 5 个标题') // 非流式，直接拿返回值
 * ```
 */
export const useAI = (options: UseAIOptions = {}) => {
    const config = useRuntimeConfig()
    /** 服务端是否配了密钥；false 时 UI 应该隐藏入口 */
    const available = computed(() => config.public.aiEnabled !== false)

    const history = ref<AiMessage[]>([])
    /** 最近一次回复内容（流式时逐字累积） */
    const content = ref('')
    const usage = ref<AiUsage | null>(null)
    const error = ref<string | null>(null)
    const pending = ref(false)
    const streaming = ref(false)
    const busy = computed(() => pending.value || streaming.value)

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

    const fail = (message: string) => {
        error.value = message
        options.onError?.(message)
        return null
    }

    /** 清空上下文与状态 */
    const clear = () => {
        history.value = []
        content.value = ''
        usage.value = null
        error.value = null
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
        pending.value = true
        controller = new AbortController()

        const incoming = toMessages(input)
        try {
            const result = await $fetch<AiChatResult>('/api/ai/chat', {
                method: 'POST',
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
            return fail(toErrorMessage(err))
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
            const res = await fetch('/api/ai/chat-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    buildBody(withSystem([...history.value, ...incoming]), opts)
                ),
                signal: controller.signal,
            })

            if (!res.ok || !res.body) {
                throw new Error(await readErrorResponse(res))
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
                return fail(toErrorMessage(err))
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
        available,
        history,
        content,
        usage,
        error,
        pending,
        streaming,
        busy,
        ask,
        askStream,
        abort,
        clear,
    }
}

/** 非 2xx 时从响应体里取服务端给出的文案 */
const readErrorResponse = async (res: Response) => {
    try {
        const data = await res.json()
        return (
            data?.statusMessage ||
            data?.message ||
            data?.data?.message ||
            res.statusText
        )
    } catch {
        return res.statusText || `AI request failed (${res.status})`
    }
}
