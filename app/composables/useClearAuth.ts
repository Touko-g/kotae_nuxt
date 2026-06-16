export function useClearAuth() {
    const isLogin = useState('isLogin')

    const clearAuth = () => {
        const cookieNames = ['token', 'refresh', 'user']
        cookieNames.forEach(name => (useCookie(name).value = null))
        isLogin.value = false
    }

    return { clearAuth }
}
