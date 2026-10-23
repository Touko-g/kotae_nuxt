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

/** 连续失败多少次后放弃自动重启（避免异常时无限循环请求识别服务） */
const MAX_FAILURES = 3
/** 自动重启前的延迟，避免 onend 立即重启形成紧密循环 */
const RESTART_DELAY = 300

/** 无法恢复的错误：直接结束听写，不再自动重启 */
const FATAL_ERRORS = ['not-allowed', 'service-not-allowed', 'audio-capture']

/** 正常现象，不提示也不计入失败（长时间静音、用户主动停止） */
const BENIGN_ERRORS = ['no-speech', 'aborted']

const errorKeyOf = (error: string) => {
    if (error === 'not-allowed' || error === 'service-not-allowed') {
        return 'speech_mic_denied'
    }
    if (error === 'audio-capture') return 'speech_no_mic'
    if (error === 'network') return 'speech_network_error'
    return 'speech_error'
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
    // 连续失败计数：任一结果回来自动清零
    let failures = 0
    // 本轮失败是否已经提示过，避免连续错误刷屏
    let notified = false
    let disposed = false
    let restartTimer: ReturnType<typeof setTimeout> | null = null

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

    const clearRestartTimer = () => {
        if (restartTimer) {
            clearTimeout(restartTimer)
            restartTimer = null
        }
    }

    const teardown = () => {
        keepAlive = false
        clearRestartTimer()
        listening.value = false
        interim.value = ''
    }

    /** 同一轮失败只提示一次，避免网络抖动时连弹三个 toast */
    const reportError = (key: string) => {
        if (notified) return
        notified = true
        options.onError?.(key)
    }

    const start = () => {
        const Ctor = getCtor()
        if (!Ctor || listening.value) return

        failures = 0
        notified = false
        clearRestartTimer()

        recognition = new Ctor()
        recognition.lang = unref(options.lang) || 'zh-CN'
        recognition.continuous = true
        recognition.interimResults = true

        recognition.onresult = event => {
            // 有结果就说明链路正常，重置失败计数
            failures = 0
            notified = false

            let finalText = ''
            let interimText = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                // results / 每条的候选都是稀疏的 SpeechRecognitionAlternative，
                // 下标访问可能取到 undefined，取不到就跳过这一条
                const result = event.results[i]
                const alt = result?.[0]
                if (!result || !alt) continue
                if (result.isFinal) {
                    finalText += alt.transcript
                } else {
                    interimText += alt.transcript
                }
            }
            interim.value = interimText
            const text = finalText.trim()
            if (text) options.onFinal?.(text)
        }

        recognition.onerror = event => {
            const fatal = FATAL_ERRORS.includes(event.error)
            const benign = BENIGN_ERRORS.includes(event.error)

            // network / 其它未知错误：计入连续失败，达到上限就放弃重启，
            // 否则 Chrome 会「报错 → onend → 重启 → 再报错」无限循环
            if (!fatal && !benign) failures += 1

            if (fatal || failures >= MAX_FAILURES) {
                teardown()
            }

            if (!benign) reportError(errorKeyOf(event.error))
        }

        recognition.onend = () => {
            // continuous 模式下 Chrome 偶尔仍会自动结束，重启以保持连续听写
            if (keepAlive && recognition && !disposed) {
                // 稍作延迟再重启：既避开紧密循环，也给失败计数一个收敛窗口
                restartTimer = setTimeout(() => {
                    restartTimer = null
                    if (!keepAlive || !recognition || disposed) return
                    try {
                        recognition.start()
                    } catch {
                        // 重启失败则正常收尾
                        teardown()
                    }
                }, RESTART_DELAY)
                return
            }
            listening.value = false
            interim.value = ''
            recognition = null
        }

        keepAlive = true
        try {
            recognition.start()
            listening.value = true
        } catch {
            teardown()
        }
    }

    const stop = () => {
        keepAlive = false
        clearRestartTimer()
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
        disposed = true
        keepAlive = false
        clearRestartTimer()
        recognition?.abort()
        recognition = null
        listening.value = false
        interim.value = ''
    })

    return { supported, listening, interim, start, stop, toggle }
}

/**
 * 拼接两段语音文本：英文/数字结尾与开头相接时补一个空格，
 * 否则「hello」「world」两段结果会粘成 helloworld；中文不受影响
 */
export const joinSpeechText = (base: string, chunk: string) => {
    if (!base) return chunk
    const needSpace = /[A-Za-z0-9]$/.test(base) && /^[A-Za-z0-9]/.test(chunk)
    return needSpace ? `${base} ${chunk}` : `${base}${chunk}`
}
