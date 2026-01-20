export default defineNuxtPlugin(() => {
    const localePath = useLocalePath()
    const router = useRouter()

    const rawPush = router.push

    router.push = (to: any) => {
        if (typeof to === 'string' && to.startsWith('/')) {
            return rawPush(localePath(to))
        }
        return rawPush(to)
    }
})
