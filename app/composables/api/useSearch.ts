type SearchResponse = BaseResponse<Tag>

export const useSearch = () => {
    const { get } = useHttp()
    const getSearchList = (options: BaseParams) =>
        get<SearchResponse>('/search', options)
    return { getSearchList }
}
