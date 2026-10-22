// Web Speech API 的最小类型声明（TS 标准库未内置该 API）
interface SpeechRecognitionAlternative {
    transcript: string
}

interface SpeechRecognitionResultItem {
    isFinal: boolean
    0: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultEvent {
    resultIndex: number
    results: ArrayLike<SpeechRecognitionResultItem>
}

interface SpeechRecognitionErrorEvent {
    error: string
}

interface SpeechRecognitionInstance {
    lang: string
    continuous: boolean
    interimResults: boolean
    onresult: ((event: SpeechRecognitionResultEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
    abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

interface SpeechRecognitionOptions {
    /** 识别语言（如 'zh-CN'），可传 Ref 跟随界面语言变化 */
    lang?: string | Ref<string>
    /** 一段已稳定的识别文本 */
    onFinal?: (text: string) => void
    /** 错误提示的 i18n key */
    onError?: (key: string) => void
}

/**
 * 语音转文字（浏览器原生 Web Speech API，仅 Chrome/Edge 等支持）
 * SSR 安全：服务端渲染时 supported 恒为 false
 */
export const useSpeechRecognition = (
    options: SpeechRecognitionOptions = {}
) => {
    const supported = ref(false)
    const listening = ref(false)
    /** 当前正在识别（未稳定）的文本，用于实时提示 */
    const interim = ref('')

    let recognition: SpeechRecognitionInstance | null = null
    // 用户是否仍希望保持听写；浏览器自动结束（onend）时据此决定是否重启
    let keepAlive = false

    const getCtor = (): SpeechRecognitionConstructor | null => {
        if (!import.meta.client) return null
        const w = window as unknown as Record<string, unknown>
        return (w.SpeechRecognition ??
            w.webkitSpeechRecognition ??
            null) as SpeechRecognitionConstructor | null
    }

    onMounted(() => {
        supported.value = getCtor() !== null
    })

    const start = () => {
        const Ctor = getCtor()
        if (!Ctor || listening.value) return

        recognition = new Ctor()
        recognition.lang = unref(options.lang) || 'zh-CN'
        recognition.continuous = true
        recognition.interimResults = true

        recognition.onresult = event => {
            let finalText = ''
            let interimText = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                if (result.isFinal) {
                    finalText += result[0].transcript
                } else {
                    interimText += result[0].transcript
                }
            }
            interim.value = interimText
            const text = finalText.trim()
            if (text) options.onFinal?.(text)
        }

        recognition.onerror = event => {
            const fatal = [
                'not-allowed',
                'service-not-allowed',
                'audio-capture',
            ].includes(event.error)
            if (fatal) {
                keepAlive = false
                listening.value = false
                interim.value = ''
            }

            if (
                event.error === 'not-allowed' ||
                event.error === 'service-not-allowed'
            ) {
                options.onError?.('speech_mic_denied')
            } else if (event.error === 'audio-capture') {
                options.onError?.('speech_no_mic')
            } else if (event.error === 'network') {
                options.onError?.('speech_network_error')
            } else if (
                event.error !== 'no-speech' &&
                event.error !== 'aborted'
            ) {
                // no-speech（没说话）和 aborted（主动停止）不提示
                options.onError?.('speech_error')
            }
        }

        recognition.onend = () => {
            // continuous 模式下 Chrome 偶尔仍会自动结束，重启以保持连续听写
            if (keepAlive && recognition) {
                try {
                    recognition.start()
                    return
                } catch {
                    // 重启失败则正常收尾
                }
            }
            listening.value = false
            interim.value = ''
        }

        keepAlive = true
        try {
            recognition.start()
            listening.value = true
        } catch {
            keepAlive = false
        }
    }

    const stop = () => {
        keepAlive = false
        recognition?.stop()
        listening.value = false
        interim.value = ''
    }

    const toggle = () => {
        if (listening.value) {
            stop()
        } else {
            start()
        }
    }

    onBeforeUnmount(() => {
        keepAlive = false
        recognition?.abort()
        recognition = null
    })

    return { supported, listening, interim, start, stop, toggle }
}
