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

export const useUser = () => {
    const { get } = useHttp()

    const user = useState<User | null>('user', () => null)

    const getUser = (id: string | number) => get<User>(`user/${id}`)

    return { getUser, user }
}
