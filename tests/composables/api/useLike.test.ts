import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLike } from '../../../app/composables/api/useLike'

describe('useLike', () => {
    const mockGet = vi.fn()
    const mockPost = vi.fn()
    const mockDel = vi.fn()

    beforeEach(() => {
        mockGet.mockReset()
        mockPost.mockReset()
        mockDel.mockReset()
        globalThis.__mockHttp = {
            get: mockGet,
            post: mockPost,
            put: vi.fn(),
            del: mockDel,
        }
    })

    it('getLikeList calls get with /like/ and params', async () => {
        mockGet.mockResolvedValue({ count: 0, results: [] })
        const { getLikeList } = useLike()

        const params = { article: 1 }
        await getLikeList(params)
        expect(mockGet).toHaveBeenCalledWith('/like/', params)
    })

    it('addLike calls post with /like/ and params', async () => {
        mockPost.mockResolvedValue({ id: 1 })
        const { addLike } = useLike()

        await addLike({ article: 5 })
        expect(mockPost).toHaveBeenCalledWith('/like/', { article: 5 })
    })

    it('delLike calls del with correct URL', async () => {
        mockDel.mockResolvedValue(undefined)
        const { delLike } = useLike()

        await delLike(3)
        expect(mockDel).toHaveBeenCalledWith('/like/3/')
    })

    it('delLike accepts string id', async () => {
        mockDel.mockResolvedValue(undefined)
        const { delLike } = useLike()

        await delLike('7')
        expect(mockDel).toHaveBeenCalledWith('/like/7/')
    })
})
