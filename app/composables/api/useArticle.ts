// 如果 swagger 里有 Article 的定义，可以写在这里
export interface Article {
    // 根据 #/definitions/Article 来补充属性
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

// 响应结构
export type ArticleListResponse = BaseResponse<Article>

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
