import { toast } from 'vue-sonner'

type ToastOptions = {
    description?: string
    duration?: number
    position?:
        | 'top-left'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-right'
        | 'top-center'
        | 'bottom-center'
}

type ToastError = Error | string

type PromiseToastMessages<T> = {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: ToastError) => string)
}

const baseClass = 'rounded-md shadow-lg border-0 font-brand'

const toastClassMap = {
    success: 'bg-success text-white',
    error: 'bg-error text-white',
    warning: 'bg-warning text-white',
    info: 'bg-info text-white',
    loading: 'bg-primary text-white',
} as const

type ToastType = keyof typeof toastClassMap

export const useToast = () => {
    const show = (
        type: ToastType,
        message: string,
        options?: ToastOptions
    ): number | string => {
        return toast[type](message, {
            class: `${baseClass} ${toastClassMap[type]}`,
            description: options?.description,
            duration: options?.duration ?? 3000,
            position: options?.position ?? 'top-right',
        })
    }

    const success = (message: string, options?: ToastOptions) =>
        show('success', message, options)

    const error = (message: string, options?: ToastOptions) =>
        show('error', message, options)

    const warning = (message: string, options?: ToastOptions) =>
        show('warning', message, options)

    const info = (message: string, options?: ToastOptions) =>
        show('info', message, options)

    const loading = (message: string, options?: ToastOptions) =>
        show('loading', message, options)

    const dismiss = (id?: number | string) => toast.dismiss(id)

    const promise = <T>(
        task: Promise<T>,
        messages: PromiseToastMessages<T>,
        options?: ToastOptions
    ): void => {
        toast.promise(task, {
            loading: messages.loading,
            success: (data: T) => ({
                message:
                    typeof messages.success === 'function'
                        ? messages.success(data)
                        : messages.success,
                class: `${baseClass} ${toastClassMap.success}`,
            }),
            error: (err: ToastError) => ({
                message:
                    typeof messages.error === 'function'
                        ? messages.error(err)
                        : messages.error,
                class: `${baseClass} ${toastClassMap.error}`,
            }),

            description: options?.description || '',
            position: options?.position ?? 'top-right',
            duration: options?.duration ?? 3000,
            class: `${baseClass} ${toastClassMap.success}`,
            descriptionClass: `${baseClass} ${toastClassMap.success}`,
        })
    }

    return {
        success,
        error,
        warning,
        info,
        loading,
        dismiss,
        promise,
    }
}
