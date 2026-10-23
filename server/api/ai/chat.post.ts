import type { AiChatRequest } from '#shared/types/ai'

/**
 * 非流式对话：POST /api/ai/chat
 * 请求体：{ messages: AiMessage[], model?, temperature?, maxTokens?, system?, extra? }
 * 返回：{ content, model, usage, finishReason }
 */
export default defineEventHandler(async event => {
    // 先取配置：没配密钥就直接 503，不必解析 body
    const config = getAiConfig(event)
    assertAiRateLimit(event, config)

    const body = (await readBody<AiChatRequest>(event)) ?? ({} as AiChatRequest)
    const { messages: rawMessages, ...options } = body
    const messages = normalizeMessages(rawMessages)

    return await requestChatCompletion(event, messages, options)
})
