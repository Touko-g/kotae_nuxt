import type { AiChatRequest } from '#shared/types/ai'

/**
 * 流式对话：POST /api/ai/chat-stream
 * 请求体与非流式一致；响应为 SSE，每条 data 是一个归一化事件：
 *   { "type": "delta", "content": "..." }
 *   { "type": "done", "model": "...", "usage": {...}, "finishReason": "stop" }
 *   { "type": "error", "message": "..." }
 */
export default defineEventHandler(async event => {
    const config = getAiConfig(event)
    assertAiRateLimit(event, config)

    const body = (await readBody<AiChatRequest>(event)) ?? ({} as AiChatRequest)
    const { messages: rawMessages, ...options } = body
    const messages = normalizeMessages(rawMessages)

    // 上游连通性在这里校验，失败直接抛 502（此时还没写 SSE 头）
    const stream = await streamChatCompletion(event, messages, options)

    setResponseHeaders(event, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // 反代（nginx / 云托管）不缓冲，否则前端拿不到逐字输出
        'X-Accel-Buffering': 'no',
    })

    return sendStream(event, stream)
})
