import { toast } from 'vue-sonner'
import type { VAlert } from 'vuetify/components'
import VToast from '~/components/VToast.vue'

type AlertProps = InstanceType<typeof VAlert>['$props']

export const useToast = () => {
    const { sound } = useSound()

    // 真正渲染贴纸 Toast（对象参数）
    const push = (options: AlertProps) => {
        const { text, type, ...rest } = options

        toast.custom(
            toastProps =>
                markRaw(
                    h(VToast, {
                        alertProps: {
                            text,
                            type,
                            density: 'compact',
                            iconSize: '24',
                            class: 'w-80',
                            'onClick:close': () => toastProps.onCloseToast(),
                            ...rest,
                        },
                    })
                ),
            {
                class: 'font-brand k-toast',
                position: 'top-center',
            }
        )
    }

    const success = (text: string, options?: AlertProps) => {
        sound('success')
        return push({ text, type: 'success', ...options })
    }

    const info = (text: string, options?: AlertProps) =>
        push({ text, type: 'info', ...options })

    const warning = (text: string, options?: AlertProps) =>
        push({ text, type: 'warning', ...options })

    const error = (text: string, options?: AlertProps) => {
        sound('error')
        return push({ text, type: 'error', ...options })
    }

    // 兼容旧 useSnackbar 调用签名：show(text, color, options)
    // color 为 Vuetify 语义色，路由到对应类型（success/error 自动带音效）；
    // primary 等未匹配色回退为中性 info
    const show = (
        text: string,
        color: string = 'primary',
        options: AlertProps = {}
    ) => {
        switch (color) {
            case 'success':
                return success(text, options)
            case 'error':
                return error(text, options)
            case 'warning':
                return warning(text, options)
            default:
                return info(text, options)
        }
    }

    return {
        show,
        success,
        info,
        warning,
        error,
    }
}
