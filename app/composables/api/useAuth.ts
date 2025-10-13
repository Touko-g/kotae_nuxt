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

export const useAuth = () => {
    const { post, put } = useHttp()

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
    }
}
