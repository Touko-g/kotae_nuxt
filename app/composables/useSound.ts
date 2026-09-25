import { play, setEnabled } from 'cuelume'

export type SoundCue =
    | 'chime'
    | 'sparkle'
    | 'droplet'
    | 'bloom'
    | 'whisper'
    | 'tick'
    | 'press'
    | 'release'
    | 'toggle'
    | 'success'
    | 'error'
    | 'page'
    | 'loading'
    | 'ready'

const STORAGE_KEY = 'cuelume-enabled'

/**
 * 交互音效（基于 cuelume，Web Audio 实时合成，无音频文件）
 * SSR 安全：仅在客户端播放
 */
export const useSound = () => {
    const soundEnabled = useState('soundEnabled', () => true)

    // 客户端初始化：从 localStorage 恢复偏好
    if (import.meta.client) {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'false') {
            soundEnabled.value = false
            setEnabled(false)
        }
    }

    const sound = (cue: SoundCue) => {
        if (import.meta.client) {
            play(cue)
        }
    }

    /** 切换音效开关（持久化到 localStorage） */
    const toggleSound = () => {
        soundEnabled.value = !soundEnabled.value
        setEnabled(soundEnabled.value)
        if (import.meta.client) {
            localStorage.setItem(STORAGE_KEY, String(soundEnabled.value))
        }
        // 开启时播放一个反馈音
        if (soundEnabled.value) {
            play('toggle')
        }
    }

    return {
        sound,
        soundEnabled,
        toggleSound,
        // 语义化快捷方法
        soundSuccess: () => sound('success'),
        soundError: () => sound('error'),
        soundToggle: () => sound('toggle'),
        soundTick: () => sound('tick'),
        soundSparkle: () => sound('sparkle'),
        soundWhisper: () => sound('whisper'),
        soundPage: () => sound('page'),
    }
}
