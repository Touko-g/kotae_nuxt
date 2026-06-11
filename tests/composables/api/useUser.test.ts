import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUser } from '../../../app/composables/api/useUser'

describe('useUser', () => {
    const mockGet = vi.fn()
    const mockPut = vi.fn()

    beforeEach(() => {
        mockGet.mockReset()
        mockPut.mockReset()
        globalThis.__mockHttp = {
            get: mockGet,
            post: vi.fn(),
            put: mockPut,
            del: vi.fn(),
        }
    })

    it('getUser calls get with correct URL', async () => {
        mockGet.mockResolvedValue({ id: 1, username: 'alice' })
        const { getUser } = useUser()

        await getUser(1)
        expect(mockGet).toHaveBeenCalledWith('user/1/')
    })

    it('getUser accepts string id', async () => {
        mockGet.mockResolvedValue({ id: 1 })
        const { getUser } = useUser()

        await getUser('abc')
        expect(mockGet).toHaveBeenCalledWith('user/abc/')
    })

    it('updateUser calls put with correct URL and data', async () => {
        mockPut.mockResolvedValue({ id: 1 })
        const { updateUser } = useUser()

        const userData = {
            username: 'alice',
            avatar: 'https://img.com/a.png',
            about: 'Hello',
            email: 'a@b.com',
        }
        await updateUser(1, userData)
        expect(mockPut).toHaveBeenCalledWith('user/1/', userData)
    })

    it('editPassword calls put with correct URL and params', async () => {
        mockPut.mockResolvedValue(undefined)
        const { editPassword } = useUser()

        const params = {
            old_password: 'old123',
            password: 'new12345',
            password2: 'new12345',
        }
        await editPassword(1, params)
        expect(mockPut).toHaveBeenCalledWith('/user/editpsw/1/', params)
    })
})
