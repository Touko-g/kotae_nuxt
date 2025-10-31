export interface Like {
    id: number
    user_info: SimpleUser
    article: number
    article_info: {
        id: number
        user: string
        avatar: string
        title: string
    }
    create_time: string
}

export interface LikeListParams extends BaseParams {
    article?: number | string
    user?: string
}

export type LikeListResponse = BaseResponse<Like>

type AddLikeParam = Pick<LikeListParams, 'article'>

export const useLike = () => {
    const { get, post, del } = useHttp()

    const getLikeList = (params: LikeListParams) =>
        get<LikeListResponse>('/like/', params)

    const addLike = (params: AddLikeParam) => post<Like>('/like/', params)

    const delLike = (id: number | string) => del(`/like/${id}/`)

    return { getLikeList, addLike, delLike }
}
