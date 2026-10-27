/**
 * `useAsyncData` 的薄封装：把「key 必须跟着参数走」变成默认行为。
 *
 * 这个项目已经两次因为固定 key 出过 bug：
 *   /article/1 → /article/2、/user/1 → /user/2
 * 原因都是同一个 —— 页面重建后 `useAsyncData` 发现同名 key 已有一份
 * `status === 'success'` 的缓存，就直接跳过请求，`data` 停在上一份数据上。
 *
 * 所以参数不再手写进 key，而是统一由 `params` 提供：
 *   - 参与 key 计算（参数变 → key 变 → 必然重新取数）
 *   - 同时作为 fetcher 的入参（fetcher 不再从外部闭包读状态，避免读到旧值）
 *
 * 附带把 `refreshCount` 统一挂进 watch：token 刷新后所有在用数据自动重取，
 * 不用每个页面各写一遍。
 */

import type { AsyncDataOptions } from '#app'

type ApiParams = Record<string, any>

/**
 * 稳定序列化查询参数：键排序、跳过空值。
 * 目的只有一个 —— 同一组参数必须永远得到同一个 key，
 * 否则 `{ a: 1, b: 2 }` 和 `{ b: 2, a: 1 }` 会各自建一份缓存。
 * 数字与字符串按同一种形式落键（`id: 1` 与 `id: '1'` 等价），避免重复条目。
 */
const stableKey = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) {
        const parts = value.map(stableKey).filter(Boolean)
        return parts.length ? `[${parts.join(',')}]` : ''
    }
    if (typeof value === 'object') {
        const record = value as ApiParams
        const parts = Object.keys(record)
            .sort()
            .filter(key => {
                const item = record[key]
                return item !== null && item !== undefined && item !== ''
            })
            .map(key => `${key}=${stableKey(record[key])}`)
        return parts.length ? parts.join('&') : ''
    }
    return String(value)
}

/** 由名称 + 参数生成缓存 key，形如 `article?id=21`（无参数时就是名称本身） */
export const apiDataKey = (name: string, params?: ApiParams): string => {
    const suffix = stableKey(params)
    return suffix ? `${name}?${suffix}` : name
}

export interface UseApiDataOptions<T, P extends ApiParams>
    extends Omit<AsyncDataOptions<T>, 'watch'> {
    /**
     * 参与 key 的响应式参数。
     * 返回值里**不要放**分页总数这类「请求回来才算得出来」的派生值 ——
     * 那会让 key 在赋值瞬间再变一次，多打一次一模一样的请求。
     */
    params?: () => P
    /** 额外的 watch 源（`refreshCount` 已自动包含，不用重复写） */
    watch?: AsyncDataOptions<T>['watch']
}

/**
 * ```ts
 * const { data: article } = await useApiData('article', p => getArticle(p.id), {
 *     params: () => ({ id: id.value }),
 * })
 * ```
 * 参数变化时 key 自动变化并重新取数；需要手动重取时用返回的 `refresh()`。
 */
export const useApiData = <T, P extends ApiParams = ApiParams>(
    name: string,
    fetcher: (params: P) => Promise<T>,
    options: UseApiDataOptions<T, P> = {}
) => {
    const { params, watch, ...rest } = options
    const refreshCount = useState('refreshCount')

    const key = computed(() => apiDataKey(name, params?.()))

    return useAsyncData<T>(key, () => fetcher(params ? params() : ({} as P)), {
        ...rest,
        watch: [refreshCount, ...(watch ?? [])],
    })
}
