export default defineNuxtPlugin(nuxtApp => {
    const loginDialog = useState('login')

    nuxtApp.vueApp.directive('permission', {
        mounted(el, binding) {
            const value = binding.value

            el.addEventListener('click', (e: Event) => {
                const token = useCookie('token').value
                const permissions = useState<string[]>('permissions').value

                if (!token) {
                    e.preventDefault()
                    e.stopPropagation()
                    loginDialog.value = true
                    return
                }

                if (value && !permissions.includes(value)) {
                    e.preventDefault()
                    e.stopPropagation()
                    alert('无操作权限')
                }
            })
        },
    })
})
