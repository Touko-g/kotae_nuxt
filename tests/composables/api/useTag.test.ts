import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTag } from '../../../app/composables/api/useTag'

describe('useTag', () => {
    const mockGet = vi.fn()

    beforeEach(() => {
        mockGet.mockReset()
        globalThis.__mockHttp = {
            get: mockGet,
            post: vi.fn(),
            put: vi.fn(),
            del: vi.fn(),
        }
    })

    it('getTagList calls get with /tag/ and params', async () => {
        mockGet.mockResolvedValue({ count: 0, results: [] })
        const { getTagList } = useTag()

        const params = { name: 'vue', page: 1 }
        await getTagList(params)
        expect(mockGet).toHaveBeenCalledWith('/tag/', params)
    })
})
