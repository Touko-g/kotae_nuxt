export interface Notice {
    id: number
    user_info: SimpleUser
    recipient_info: SimpleUser
    verb: string
    target_info: {
        id?: number
        title?: string
    }
    content: string
    reply_content: string
    read: boolean
    create_time: string
}

export interface NoticeListParams extends BaseParams {
    read?: boolean
    verb?: string
}

type NoticeListResponse = BaseResponse<Notice>

export const useNotice = () => {
    const { get, post } = useHttp()

    const getNoticeList = (params: NoticeListParams) =>
        get<NoticeListResponse>('/notice/', params)

    const readNotice = (data: { id?: number }) => post('/notice_read/', data)

    return { getNoticeList, readNotice }
}
