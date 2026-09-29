// 心愿单：对应后端 #/definitions/Wish
export interface Wish {
    id: number
    user_info: string
    title: string
    content: string
    completed: boolean
    complete_time: string | null
    create_time: string
    update_time: string
}

export interface WishListParams extends BaseParams {
    completed?: boolean
    title?: string
}

export type WishListResponse = BaseResponse<Wish>

// 创建可提交字段（title 必填，其余可选）
type WishCreateParams = Pick<Wish, 'title'> &
    Partial<Pick<Wish, 'content' | 'completed'>>

// PATCH 局部更新字段（全部可选，允许只传 completed 等单个字段）
type WishUpdateParams = Partial<Pick<Wish, 'title' | 'content' | 'completed'>>

export const useWish = () => {
    const { get, post, patch, del } = useHttp()

    const getWishList = (params: WishListParams) =>
        get<WishListResponse>('/wish/', params)

    const getWish = (id: number | string) => get<Wish>(`/wish/${id}/`)

    const addWish = (params: WishCreateParams) => post<Wish>('/wish/', params)

    // 用 PATCH 做局部更新，避免 PUT 全量覆盖导致 completed 等字段被重置
    const updateWish = (id: number | string, params: WishUpdateParams) =>
        patch<Wish>(`/wish/${id}/`, params)

    const delWish = (id: number | string) => del(`/wish/${id}/`)

    return { getWishList, getWish, addWish, updateWish, delWish }
}
