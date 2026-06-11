import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSearch } from '../../../app/composables/api/useSearch'

describe('useSearch', () => {
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

    it('getSearchList calls get with /search/ and params', async () => {
        mockGet.mockResolvedValue({ count: 0, results: [] })
        const { getSearchList } = useSearch()

        const params = { page: 1 }
        await getSearchList(params)
        expect(mockGet).toHaveBeenCalledWith('/search/', params)
    })

    it('addSearch calls post with /search/ and params', async () => {
        mockPost.mockResolvedValue(undefined)
        const { addSearch } = useSearch()

        await addSearch({ name: 'vue' })
        expect(mockPost).toHaveBeenCalledWith('/search/', { name: 'vue' })
    })
})
