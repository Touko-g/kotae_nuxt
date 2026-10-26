import { useHttp } from '../useHttp'
import type { User } from '#shared/types/api'

// 类型本体在 shared/types/api.ts（nuxt.config 也要用），这里 re-export 保持老路径
export type { User }

export type SimpleUser = Pick<User, 'id' | 'username' | 'avatar'>

export type UpdateUser = Pick<User, 'username' | 'avatar' | 'about' | 'email'>

export interface EditPasswordParams {
    old_password: string
    password: string
    password2: string
}

export const useUser = () => {
    const { get, put } = useHttp()

    const getUser = (id: string | number) => get<User>(`user/${id}/`)

    const updateUser = (id: string | number, userData: UpdateUser) =>
        put<User>(`user/${id}/`, userData)

    const editPassword = (id: string | number, params: EditPasswordParams) =>
        put(`/user/editpsw/${id}/`, params)

    return { getUser, updateUser, editPassword }
}
