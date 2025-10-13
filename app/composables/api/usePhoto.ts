export interface Photo {
    id: number
    user_info: SimpleUser
    name: string
    picture: string
    create_time: string
    update_time: string
}

export interface PhotoListParams extends BaseParams {
    user?: string
}

type PhotoListResponse = BaseResponse<Photo>

export const usePhoto = () => {
    const { get } = useHttp()

    const getPhotoList = (params: PhotoListParams) =>
        get<PhotoListResponse>('/photo/', params)

    return { getPhotoList }
}
