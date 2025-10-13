export interface BaseParams {
    page?: number
    pagesize?: number
    order?: string
}

export interface BaseResponse<T> {
    count: number
    next: string | null
    previous: string | null
    results: T[]
}
