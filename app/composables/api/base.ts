export interface BaseParams {
    page?: number
    pageSize?: number
    order?: string
}

export interface BaseResponse<T> {
    count: number
    next: string | null
    previous: string | null
    results: T[]
}
