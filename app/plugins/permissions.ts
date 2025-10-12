export default defineNuxtPlugin(nuxtApp => {
    const loginDialog = useState('login')

    nuxtApp.vueApp.directive('permission', {
        mounted(el, binding) {
            const token = useCookie('token').value
            const permissions = useState<string[]>('permissions').value
            const value = binding.value
            // 未登录禁用
            if (!token) {
                el.addEventListener('click', (e: Event) => {
                    e.preventDefault()
                    e.stopPropagation()
                    loginDialog.value = true
                })
                return
            }

            // 无权限禁用
            if (value && !permissions.includes(value)) {
                el.addEventListener('click', (e: Event) => {
                    e.preventDefault()
                    e.stopPropagation()
                    alert('无操作权限')
                })
            }
        },
    })
})
