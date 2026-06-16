export default defineNuxtRouteMiddleware(() => {
    const isLogin = useState('isLogin')

    const token = useCookie('token', AUTH_COOKIE_OPTIONS).value
    const refreshToken = useCookie('refresh', AUTH_COOKIE_OPTIONS).value

    if (isLogin.value || (token && refreshToken)) {
        isLogin.value = true
        return
    }

    return navigateTo('/')
})
