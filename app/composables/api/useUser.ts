export interface User {
    id: string | number
    username: string
    email: string
    about: string
    avatar: string
    article: number
    create_time: string
    update_time: string
}

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
