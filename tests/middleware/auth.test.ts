import { describe, it, expect, vi, beforeEach } from 'vitest'

import authMiddleware from '../../app/middleware/auth'

describe('auth middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset navigateTo mock
        ;(globalThis.navigateTo as any).mockClear()
    })

    it('allows access when isLogin is true', () => {
        const isLogin = useState('isLogin', () => false)
        isLogin.value = true

        const result = authMiddleware()
        expect(navigateTo).not.toHaveBeenCalled()
        expect(result).toBeUndefined()
    })

    it('allows access when token and refresh cookies exist', () => {
        const tokenCookie = useCookie('token')
        const refreshCookie = useCookie('refresh')
        tokenCookie.value = 'my-token'
        refreshCookie.value = 'my-refresh'

        authMiddleware()
        expect(navigateTo).not.toHaveBeenCalled()
    })

    it('redirects to / when not logged in and no cookies', () => {
        // Ensure fresh state
        const isLogin = useState('isLogin', () => false)
        isLogin.value = false
        const tokenCookie = useCookie('token')
        const refreshCookie = useCookie('refresh')
        tokenCookie.value = null
        refreshCookie.value = null

        authMiddleware()
        expect(navigateTo).toHaveBeenCalledWith('/')
    })

    it('redirects when only token exists (no refresh)', () => {
        const isLogin = useState('isLogin', () => false)
        isLogin.value = false
        const tokenCookie = useCookie('token')
        const refreshCookie = useCookie('refresh')
        tokenCookie.value = 'my-token'
        refreshCookie.value = null

        authMiddleware()
        expect(navigateTo).toHaveBeenCalledWith('/')
    })

    it('redirects when only refresh exists (no token)', () => {
        const isLogin = useState('isLogin', () => false)
        isLogin.value = false
        const tokenCookie = useCookie('token')
        const refreshCookie = useCookie('refresh')
        tokenCookie.value = null
        refreshCookie.value = 'my-refresh'

        authMiddleware()
        expect(navigateTo).toHaveBeenCalledWith('/')
    })

    it('sets isLogin to true when cookies are valid', () => {
        const isLogin = useState('isLogin', () => false)
        isLogin.value = false
        const tokenCookie = useCookie('token')
        const refreshCookie = useCookie('refresh')
        tokenCookie.value = 'my-token'
        refreshCookie.value = 'my-refresh'

        authMiddleware()

        expect(isLogin.value).toBe(true)
    })
})
