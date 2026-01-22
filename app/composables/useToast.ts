import { toast } from 'vue-sonner'
import type { VAlert } from 'vuetify/components'
import VToast from '~/components/VToast.vue'

type AlertProps = InstanceType<typeof VAlert>['$props']

export const useToast = () => {
    const show = (options: AlertProps) => {
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
                class: 'font-brand',
                position: 'top-right',
            }
        )
    }

    const success = (text: string, options?: AlertProps) =>
        show({ text, type: 'success', ...options })

    const info = (text: string, options?: AlertProps) =>
        show({ text, type: 'info', ...options })

    const warning = (text: string, options?: AlertProps) =>
        show({ text, type: 'warning', ...options })

    const error = (text: string, options?: AlertProps) =>
        show({ text, type: 'error', ...options })

    return {
        success,
        info,
        warning,
        error,
    }
}
