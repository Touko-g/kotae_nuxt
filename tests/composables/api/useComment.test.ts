import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useComment } from '../../../app/composables/api/useComment'

describe('useComment', () => {
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

    it('getCommentList calls get with /comment/ and params', async () => {
        mockGet.mockResolvedValue({ count: 0, results: [] })
        const { getCommentList } = useComment()

        const params = { article: 1, page: 1 }
        await getCommentList(params)
        expect(mockGet).toHaveBeenCalledWith('/comment/', params)
    })

    it('postComment calls post with /comment/ and params', async () => {
        mockPost.mockResolvedValue({ id: 1 })
        const { postComment } = useComment()

        const params = { article: 1, content: 'Nice!' }
        await postComment(params)
        expect(mockPost).toHaveBeenCalledWith('/comment/', params)
    })

    it('postComment with reply', async () => {
        mockPost.mockResolvedValue({ id: 2 })
        const { postComment } = useComment()

        const params = { article: 1, reply: 1, content: 'Reply!' }
        await postComment(params)
        expect(mockPost).toHaveBeenCalledWith('/comment/', params)
    })
})
