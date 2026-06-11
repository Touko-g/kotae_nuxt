import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useArticle } from '../../../app/composables/api/useArticle'

describe('useArticle', () => {
    const mockGet = vi.fn()
    const mockPost = vi.fn()
    const mockPut = vi.fn()
    const mockDel = vi.fn()

    beforeEach(() => {
        mockGet.mockReset()
        mockPost.mockReset()
        mockPut.mockReset()
        mockDel.mockReset()
        globalThis.__mockHttp = {
            get: mockGet,
            post: mockPost,
            put: mockPut,
            del: mockDel,
        }
    })

    it('getArticle calls get with correct URL', async () => {
        mockGet.mockResolvedValue({ id: 1, title: 'Test' })
        const { getArticle } = useArticle()

        await getArticle(1)
        expect(mockGet).toHaveBeenCalledWith('/article/1/')
    })

    it('getArticle accepts string id', async () => {
        mockGet.mockResolvedValue({ id: 1 })
        const { getArticle } = useArticle()

        await getArticle('42')
        expect(mockGet).toHaveBeenCalledWith('/article/42/')
    })

    it('getArticleList calls get with params', async () => {
        mockGet.mockResolvedValue({ count: 0, results: [] })
        const { getArticleList } = useArticle()

        const params = { page: 1, pagesize: 10, tag: 'vue' }
        await getArticleList(params)
        expect(mockGet).toHaveBeenCalledWith('/article/', params)
    })

    it('createArticle calls post with params', async () => {
        mockPost.mockResolvedValue({ id: 1 })
        const { createArticle } = useArticle()

        const params = {
            title: 'New Article',
            tag: [{ name: 'vue' }],
            content: '<p>Content</p>',
        }
        await createArticle(params)
        expect(mockPost).toHaveBeenCalledWith('/article/create', params)
    })

    it('updateArticle calls put with id and params', async () => {
        mockPut.mockResolvedValue({ id: 1 })
        const { updateArticle } = useArticle()

        const params = {
            title: 'Updated',
            tag: [{ name: 'vue' }],
            content: '<p>Updated</p>',
        }
        await updateArticle(1, params)
        expect(mockPut).toHaveBeenCalledWith('/article/1/', params)
    })

    it('delArticle calls del with correct URL', async () => {
        mockDel.mockResolvedValue(undefined)
        const { delArticle } = useArticle()

        await delArticle(5)
        expect(mockDel).toHaveBeenCalledWith('/article/5/')
    })
})
