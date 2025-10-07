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

// 请求参数
export interface ArticleListParams extends BaseParams {
    title?: string
    content?: string
    tag?: string
    author?: string
}

// 响应结构
type ArticleListResponse = BaseResponse<Article>

export const useArticle = () => {
    const { get } = useHttp()
    const getArticle = (id: number | string) => get<Article>(`/article/${id}`)
    const getArticleList = (options: ArticleListParams) =>
        get<ArticleListResponse>('/article', options)
    return { getArticle, getArticleList }
}
