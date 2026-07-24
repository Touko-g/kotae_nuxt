import type { Anchor } from 'vuetify'

export interface SnackOptions {
    text: string
    color?: string
    duration?: number
    position?: Anchor
    close?: boolean
}

export interface SnackMessage extends Required<SnackOptions> {
    id: number
    visible: boolean
}

const messages = reactive<SnackMessage[]>([])
let idCounter = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

export const useSnackbar = () => {
    const { sound } = useSound()

    const show = (
        text: string,
        color = 'primary',
        options: Partial<Omit<SnackOptions, 'text' | 'color'>> = {}
    ) => {
        // 根据通知类型播放对应音效
        if (color === 'success') sound('success')
        else if (color === 'error') sound('error')

        const id = ++idCounter
        const msg: SnackMessage = {
            id,
            text,
            color,
            duration: options.duration ?? 3000,
            position: options.position ?? 'top',
            close: options.close ?? true,
            visible: true,
        }

        messages.push(msg)

        // 自动移除（支持延时取消）
        const timer = setTimeout(() => close(id), msg.duration + 400)
        timers.set(id, timer)
    }

    const close = (id: number) => {
        const index = messages.findIndex(m => m.id === id)
        if (index !== -1) {
            const msg = messages[index]
            if (msg) {
                msg.visible = false
                clearTimeout(timers.get(id))
                timers.delete(id)

                // 延迟移除，等待动画结束
                setTimeout(() => {
                    const idx = messages.findIndex(m => m.id === id)
                    if (idx !== -1) messages.splice(idx, 1)
                }, 0)
            }
        }
    }

    return { messages, show, close }
}
