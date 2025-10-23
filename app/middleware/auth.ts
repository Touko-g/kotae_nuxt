export default defineNuxtRouteMiddleware(() => {
    const isLogin = useState('isLogin')

    const token = useCookie('token').value
    const refreshToken = useCookie('refresh').value

    if (isLogin.value || (token && refreshToken)) {
        isLogin.value = true
        return
    }

    return navigateTo('/')
})
