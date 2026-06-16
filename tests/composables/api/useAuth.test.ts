import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuth as useAuthReal } from '../../../app/composables/api/useAuth'

describe('useAuth', () => {
    const mockGet = vi.fn()
    const mockPost = vi.fn()
    const mockPut = vi.fn()

    beforeEach(() => {
        mockGet.mockReset()
        mockPost.mockReset()
        mockPut.mockReset()
        globalThis.__mockHttp = {
            get: mockGet,
            post: mockPost,
            put: mockPut,
            del: vi.fn(),
        }
    })

    it('login calls post with /token/', async () => {
        mockPost.mockResolvedValue({ access: 'tok', refresh: 'ref' })
        const { login } = useAuthReal()

        await login({ username: 'user', password: 'pass' })
        expect(mockPost).toHaveBeenCalledWith('/token/', {
            username: 'user',
            password: 'pass',
        })
    })

    it('refresh calls post with /token/refresh/', async () => {
        mockPost.mockResolvedValue({ access: 'new', refresh: 'new_ref' })
        const { refresh } = useAuthReal()

        await refresh({ refresh: 'old_ref' })
        expect(mockPost).toHaveBeenCalledWith('/token/refresh/', {
            refresh: 'old_ref',
        })
    })

    it('verify calls post with /token/verify/', async () => {
        mockPost.mockResolvedValue({})
        const { verify } = useAuthReal()

        await verify({ token: 'my_token' })
        expect(mockPost).toHaveBeenCalledWith('/token/verify/', {
            token: 'my_token',
        })
    })

    it('getCode calls post with /code/', async () => {
        mockPost.mockResolvedValue({ detail: 'sent' })
        const { getCode } = useAuthReal()

        await getCode({ email: 'a@b.com' })
        expect(mockPost).toHaveBeenCalledWith('/code/', { email: 'a@b.com' })
    })

    it('resetCode calls post with /resetcode/', async () => {
        mockPost.mockResolvedValue({ detail: 'sent' })
        const { resetCode } = useAuthReal()

        await resetCode({ email: 'a@b.com' })
        expect(mockPost).toHaveBeenCalledWith('/resetcode/', {
            email: 'a@b.com',
        })
    })

    it('resetPsw calls put with /user/resetpsw/', async () => {
        mockPut.mockResolvedValue({})
        const { resetPsw } = useAuthReal()

        const params = {
            email: 'a@b.com',
            code: '123456',
            password: 'newpass123',
            password2: 'newpass123',
        }
        await resetPsw(params)
        expect(mockPut).toHaveBeenCalledWith('/user/resetpsw/', params)
    })

    it('register calls post with /register/', async () => {
        mockPost.mockResolvedValue({ username: 'user' })
        const { register } = useAuthReal()

        const params = {
            username: 'user',
            email: 'a@b.com',
            code: '123456',
            password: 'pass1234',
            password2: 'pass1234',
        }
        await register(params)
        expect(mockPost).toHaveBeenCalledWith('/register/', params)
    })

    it('logout calls post with /logout/', async () => {
        mockPost.mockResolvedValue(undefined)
        const { logout } = useAuthReal()

        await logout({ refresh_token: 'ref_tok' })
        expect(mockPost).toHaveBeenCalledWith('/logout/', {
            refresh_token: 'ref_tok',
        })
    })

    it('logoutAll calls post with /logout_all/', async () => {
        mockPost.mockResolvedValue(undefined)
        const { logoutAll } = useAuthReal()

        await logoutAll()
        expect(mockPost).toHaveBeenCalledWith('/logout_all/')
    })

    it('getCosKey calls get with /coskey/', async () => {
        mockGet.mockResolvedValue({ credentials: {} })
        const { getCosKey } = useAuthReal()

        await getCosKey()
        expect(mockGet).toHaveBeenCalledWith('/coskey/')
    })

    it('exposes isLogin reactive state', () => {
        const { isLogin } = useAuthReal()
        expect(isLogin).toBeDefined()
    })
})
