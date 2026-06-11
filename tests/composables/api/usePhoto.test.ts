import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePhoto } from '../../../app/composables/api/usePhoto'

describe('usePhoto', () => {
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

    it('getPhotoList calls get with /photo/ and params', async () => {
        mockGet.mockResolvedValue({ count: 0, results: [] })
        const { getPhotoList } = usePhoto()

        const params = { user: 'alice' }
        await getPhotoList(params)
        expect(mockGet).toHaveBeenCalledWith('/photo/', params)
    })

    it('addPhoto calls post with /photo/ and params', async () => {
        mockPost.mockResolvedValue({ id: 1 })
        const { addPhoto } = usePhoto()

        const params = { picture: 'https://img.com/a.png', name: 'sunset' }
        await addPhoto(params)
        expect(mockPost).toHaveBeenCalledWith('/photo/', params)
    })

    it('addPhoto without name', async () => {
        mockPost.mockResolvedValue({ id: 2 })
        const { addPhoto } = usePhoto()

        const params = { picture: 'https://img.com/b.png' }
        await addPhoto(params)
        expect(mockPost).toHaveBeenCalledWith('/photo/', params)
    })

    it('delPhoto calls del with correct URL', async () => {
        mockDel.mockResolvedValue(undefined)
        const { delPhoto } = usePhoto()

        await delPhoto(10)
        expect(mockDel).toHaveBeenCalledWith('/photo/10/')
    })

    it('delPhoto accepts string id', async () => {
        mockDel.mockResolvedValue(undefined)
        const { delPhoto } = usePhoto()

        await delPhoto('abc')
        expect(mockDel).toHaveBeenCalledWith('/photo/abc/')
    })
})
