export interface Tag {
    id: number
    name: string
    hot: number
}

interface TagListParams extends BaseParams {
    name: string
}

type TagListResponse = BaseResponse<Tag>

export const useTag = () => {
    const { get } = useHttp()
    const getTagList = (params: TagListParams) =>
        get<TagListResponse>('/tag/', params)
    return { getTagList }
}
