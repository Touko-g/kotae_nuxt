type SearchResponse = BaseResponse<Tag>

type search = {
    name: string
}

export const useSearch = () => {
    const { get, post } = useHttp()
    const getSearchList = (options: BaseParams) =>
        get<SearchResponse>('/search/', options)
    const addSearch = (params: search) => post('/search/', params)
    return { getSearchList, addSearch }
}
