// 这些类型/工具在 Nuxt 里是自动导入的（.nuxt/types/imports.d.ts 的 declare global），
// 但 vue-tsc 对「自动导入的类型」解析不稳定，显式写出来更可靠，也方便跳转
import { useHttp } from '../useHttp'
import type {
    Article,
    ArticleListResponse,
    BaseParams,
    Tag,
} from '#shared/types/api'

// Article / ArticleListResponse 的本体在 shared/types/api.ts —— nuxt.config.ts 预渲染
// 时要拉文章列表，而它属于 node 项目（没有 Nuxt 自动导入）。这里 re-export，调用方不变。
export type { Article, ArticleListResponse }

export type SimpleArticle = Pick<Article, 'id' | 'comments' | 'title'> & {
    len: number
}

// 请求参数
export interface ArticleListParams extends BaseParams {
    title?: string
    content?: string
    tag?: string
    author?: string
}

export interface ArticleCreateParams {
    title: string
    tag: Array<Pick<Tag, 'name'>>
    content: string
}

export const useArticle = () => {
    const { get, post, put, del } = useHttp()
    const getArticle = (id: number | string) => get<Article>(`/article/${id}/`)
    const getArticleList = (options: ArticleListParams) =>
        get<ArticleListResponse>('/article/', options)
    const createArticle = (params: ArticleCreateParams) =>
        post<Article>(`/article/create/`, params)
    const updateArticle = (id: number | string, params: ArticleCreateParams) =>
        put<Article>(`/article/${id}/`, params)
    const delArticle = (id: number | string) => del(`/article/${id}/`)
    return {
        getArticle,
        getArticleList,
        createArticle,
        updateArticle,
        delArticle,
    }
}
