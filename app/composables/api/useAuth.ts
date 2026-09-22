export interface LoginParams {
    username: string
    password: string
}

export interface LoginResponse {
    refresh: string
    access: string
}

type RefreshParams = Pick<LoginResponse, 'refresh'>

type VerifyResponse = {
    code?: string
    detail?: string
}

export interface RegisterParams {
    username: string
    about?: string
    email: string
    code: string
    password: string
    password2: string
}

type RegisterResponse = Pick<RegisterParams, 'username' | 'email' | 'about'>

type RegisterCode = Pick<RegisterParams, 'email'>

type RegisterCodeResponse = Pick<VerifyResponse, 'detail'>

type LogoutParams = {
    refresh_token: string
}

type ResetParams = Pick<
    RegisterParams,
    'email' | 'code' | 'password' | 'password2'
>

export type CosKeyResponse = {
    credentials: {
        sessionToken: string
        tmpSecretId: string
        tmpSecretKey: string
    }
    expiration: string
    expiredTime: number
    requestId: string
    startTime: number
}

export const useAuth = () => {
    const { get, post, put } = useHttp()

    const { t } = useLocale()

    const isLogin = useState('isLogin', () => false)

    const login = (params: LoginParams) =>
        post<LoginResponse>('/token/', params)

    const refresh = (params: RefreshParams) =>
        post<LoginResponse>('/token/refresh/', params)

    const verify = (params: { token: string }) =>
        post<VerifyResponse>('/token/verify/', params)

    const getCode = (params: RegisterCode) =>
        post<RegisterCodeResponse>('/code/', params)

    const resetCode = (params: RegisterCode) =>
        post<RegisterCodeResponse>('/resetcode/', params)

    const resetPsw = (params: ResetParams) =>
        put<ResetParams>('/user/resetpsw/', params)

    const register = (params: RegisterParams) =>
        post<RegisterResponse>('/register/', params)

    const logout = (params: LogoutParams) => post('/logout/', params)

    const logoutAll = () => post('/logout_all/')

    /** 登出并清理本地凭据（登录态/导航/提示统一处理） */
    const performLogout = async () => {
        const route = useRoute()
        const loading = useState('loading')
        const { show } = useSnackbar()

        const refreshCookie = useCookie('refresh')
        const tokenCookie = useCookie('token')
        const userCookie = useCookie('user')

        if (!refreshCookie.value) return
        loading.value = true
        try {
            await logout({ refresh_token: refreshCookie.value })
            isLogin.value = false
            refreshCookie.value = null
            tokenCookie.value = null
            userCookie.value = null
            if (
                !(
                    route.fullPath === '/' ||
                    route.fullPath.startsWith('/article')
                )
            ) {
                navigateTo('/')
            }
            show(t('logout_success'), 'success')
        } catch (e) {
        } finally {
            loading.value = false
        }
    }

    const getCosKey = () => get<CosKeyResponse>('/coskey/')

    return {
        isLogin,
        login,
        refresh,
        verify,
        getCode,
        resetCode,
        resetPsw,
        register,
        logout,
        logoutAll,
        performLogout,
        getCosKey,
    }
}
