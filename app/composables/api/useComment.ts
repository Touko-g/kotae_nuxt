export interface BaseComment {
    id: number
    content: string
    user_info: SimpleUser
    ip_address: string
    create_time: string
}

export interface ReplyComment extends BaseComment {
    reply_user: string
}

export interface Comment extends ReplyComment {
    article: number
    article_info: SimpleArticle
    reply: number | null
    comment_replies: ReplyComment[]
}

export interface CommentParam {
    article: number
    reply?: number
    content: string
}

export interface CommentListParams extends BaseParams {
    article?: number
    user?: string
}

export type CommentListResponse = BaseResponse<Comment>

export const useComment = () => {
    const { get, post } = useHttp()
    const getCommentList = (options: CommentListParams) =>
        get<CommentListResponse>('/comment/', options)
    const postComment = (params: CommentParam) =>
        post<Comment>('/comment/', params)

    return {
        getCommentList,
        postComment,
    }
}
