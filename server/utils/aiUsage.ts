import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AiUsage, AiUsageDay } from '#shared/types/ai'

/**
 * 本地用量统计。
 *
 * 官方免费额度只能在百炼控制台看（没有公开 API），所以「额度」这件事我们只能
 * 自己记账：每次调用成功后把上游返回的 usage 累加到当天。这里统计的是
 * **本站发起的调用**，不等于账号总用量，但足够回答「今天被 AI 花掉多少」。
 *
 * 落盘到 .data/（已在 .gitignore 里），单实例 node-server 够用；
 * 多实例部署需要换共享存储。
 */

const FILE = join(process.cwd(), '.data', 'ai-usage.json')

/** 只保留最近 30 天，避免文件无限增长 */
const KEEP_DAYS = 30

type Store = Record<string, AiUsageDay>

const todayKey = () => new Date().toISOString().slice(0, 10)

const emptyDay = (date: string): AiUsageDay => ({
    date,
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    byModel: {},
})

const readStore = async (): Promise<Store> => {
    try {
        const raw = await readFile(FILE, 'utf8')
        const json = JSON.parse(raw)
        return json && typeof json === 'object' ? (json as Store) : {}
    } catch {
        // 文件不存在 / 内容损坏都当成空账本，不要影响对话本身
        return {}
    }
}

const writeStore = async (store: Store) => {
    const dates = Object.keys(store).sort()
    for (const date of dates.slice(0, Math.max(0, dates.length - KEEP_DAYS))) {
        delete store[date]
    }
    await mkdir(dirname(FILE), { recursive: true })
    await writeFile(FILE, JSON.stringify(store, null, 2), 'utf8')
}

// 串行化「读-改-写」：并发请求下两个写操作会互相覆盖
let queue: Promise<unknown> = Promise.resolve()

/** 记一笔用量。写盘失败只丢统计，不影响对话 */
export const recordAiUsage = (model: string, usage: AiUsage | null) => {
    const run = async () => {
        const store = await readStore()
        const date = todayKey()
        const day = store[date] ?? emptyDay(date)

        day.requests += 1
        if (usage) {
            day.promptTokens += usage.promptTokens
            day.completionTokens += usage.completionTokens
            day.totalTokens += usage.totalTokens
        }

        const key = model || 'unknown'
        const item = day.byModel[key] ?? { requests: 0, totalTokens: 0 }
        item.requests += 1
        item.totalTokens += usage?.totalTokens ?? 0
        day.byModel[key] = item

        store[date] = day
        await writeStore(store)
    }

    queue = queue.then(run).catch(() => {})
    return queue
}

/** 读今天的用量 + 最近 30 天合计 */
export const readAiUsage = async () => {
    const store = await readStore()
    const today = store[todayKey()] ?? emptyDay(todayKey())
    const days = Object.values(store)

    return {
        today,
        total: {
            days: days.length,
            requests: days.reduce((sum, day) => sum + day.requests, 0),
            totalTokens: days.reduce((sum, day) => sum + day.totalTokens, 0),
        },
    }
}
