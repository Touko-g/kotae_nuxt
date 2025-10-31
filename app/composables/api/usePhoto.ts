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

type PhotoParams = Pick<Photo, 'picture'> & Partial<Pick<Photo, 'name'>>

export const usePhoto = () => {
    const { get, post, del } = useHttp()

    const getPhotoList = (params: PhotoListParams) =>
        get<PhotoListResponse>('/photo/', params)

    const addPhoto = (params: PhotoParams) => post<Photo>('/photo/', params)

    const delPhoto = (id: string | number) => del(`/photo/${id}/`)

    return { getPhotoList, addPhoto, delPhoto }
}
