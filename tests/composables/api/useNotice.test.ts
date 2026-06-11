import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNotice } from '../../../app/composables/api/useNotice'

describe('useNotice', () => {
    const mockGet = vi.fn()
    const mockPost = vi.fn()

    beforeEach(() => {
        mockGet.mockReset()
        mockPost.mockReset()
        globalThis.__mockHttp = {
            get: mockGet,
            post: mockPost,
            put: vi.fn(),
            del: vi.fn(),
        }
    })

    it('getNoticeList calls get with /notice/ and params', async () => {
        mockGet.mockResolvedValue({ count: 0, results: [] })
        const { getNoticeList } = useNotice()

        const params = { read: false, page: 1 }
        await getNoticeList(params)
        expect(mockGet).toHaveBeenCalledWith('/notice/', params)
    })

    it('readNotice calls post with /notice_read/ and data', async () => {
        mockPost.mockResolvedValue(undefined)
        const { readNotice } = useNotice()

        await readNotice({ id: 5 })
        expect(mockPost).toHaveBeenCalledWith('/notice_read/', { id: 5 })
    })

    it('readNotice without id (read all)', async () => {
        mockPost.mockResolvedValue(undefined)
        const { readNotice } = useNotice()

        await readNotice({})
        expect(mockPost).toHaveBeenCalledWith('/notice_read/', {})
    })
})
