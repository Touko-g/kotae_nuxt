/**
 * 后端接口的纯类型定义。
 *
 * 放在 `shared/` 而不是 `app/composables/api/`：`nuxt.config.ts` 也要用这些类型
 * （预渲染时拉文章列表），而 config 属于 node 项目 —— 那个项目里没有 Nuxt 自动导入，
 * 一旦 import 到 `useHttp.ts` 这种依赖 `ref` / `useCookie` / `useState` 的运行时文件，
 * 整条链都会被拖进来编译，报一屏「Cannot find name 'useCookie'」。
 *
 * 这里只放 interface / type，不 import 任何东西，两个项目都能安全引用。
 */

/** 列表类接口的公共查询参数 */
export interface BaseParams {
    page?: number
    pagesize?: number
    order?: string
}

/** 分页响应外壳 */
export interface BaseResponse<T> {
    count: number
    next: string | null
    previous: string | null
    results: T[]
}

export interface Tag {
    id: number
    name: string
    hot: number
}

export interface User {
    id: string | number
    username: string
    email: string
    about: string
    avatar: string
    article: number
    create_time: string
    update_time: string
}

export interface Article {
    id: number
    title: string
    owner: Omit<User, 'update_time' | 'create_time'>
    tag: Tag[]
    likes: number
    content: string
    views: number
    comments: number
    public: boolean
    create_time: string
    update_time: string
}

export type ArticleListResponse = BaseResponse<Article>
