import type { AiQuotaInfo } from '#shared/types/ai'

/**
 * GET /api/ai/quota —— 用量 / 额度
 *
 * 说清楚能查什么、不能查什么：
 * - **官方免费额度**：百炼只在控制台页面展示，没有公开 API（文档明确写了
 *   免费额度与模型用量都在 console 看，且用量数据延迟约 1 小时）。
 *   所以 `officialAvailable` 恒为 false，前端给一个控制台外链。
 * - **本站用量**：我们自己记账（见 server/utils/aiUsage.ts），按天累加 token。
 *
 * 不要为了「看起来有额度」去伪造数字 —— 那比不显示更糟。
 */

const FREE_QUOTA_URL =
    'https://bailian.console.aliyun.com/cn-beijing/costing-balance/free-quota'

export default defineEventHandler(async event => {
    getAiConfig(event)

    const { today, total } = await readAiUsage()

    const info: AiQuotaInfo = {
        today,
        total,
        officialAvailable: false,
        consoleUrl: FREE_QUOTA_URL,
    }

    return info
})
