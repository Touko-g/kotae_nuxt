import { useHttp } from '../useHttp'
import type { BaseParams, BaseResponse, Tag } from '#shared/types/api'

// 类型本体在 shared/types/api.ts（nuxt.config 也要用），这里 re-export 保持老路径
export type { Tag }

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
