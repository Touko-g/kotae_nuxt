/**
 * 正文划词：把「用户在正文里选中了一段话」收成一个可复用的状态。
 *
 * 这里只负责探测选区、算浮条该出现在哪儿；弹什么、点了做什么由调用方决定。
 * 组件层不该知道有 AI 这回事 —— 以后想加「复制引用」「生成摘录」都不用动这个文件。
 */

export interface SelectionAnchor {
    /** 选区在视口里的位置（position: fixed 坐标系） */
    top: number
    /** 选区水平中点，浮条据此居中 */
    left: number
    width: number
    height: number
}

export interface UseTextSelectionOptions {
    /** 只在选区落在容器内时才认为有效 */
    container: () => HTMLElement | null | undefined
    /** 关掉时（未登录 / 站点关了 AI）不弹条 */
    enabled?: () => boolean
    /** 太短的选区多半是误触，不值得弹 */
    minLength?: number
    /** 太长的选区塞进提示词没意义，也容易顶爆上下文 */
    maxLength?: number
}

/** 选区稳定多久后才弹条：拖动选择时 selectionchange 会连续触发，等它停下来 */
const SHOW_DELAY = 120
const DEFAULT_MIN = 2
const DEFAULT_MAX = 1200

export const useTextSelection = (options: UseTextSelectionOptions) => {
    const visible = ref(false)
    const text = ref('')
    /** 原文超过上限被截断，UI 据此提示「只带了前 N 字」 */
    const truncated = ref(false)
    const anchor = reactive<SelectionAnchor>({
        top: 0,
        left: 0,
        width: 0,
        height: 0,
    })

    const minLength = options.minLength ?? DEFAULT_MIN
    const maxLength = options.maxLength ?? DEFAULT_MAX
    let timer: ReturnType<typeof setTimeout> | null = null

    const hide = () => {
        if (timer) {
            clearTimeout(timer)
            timer = null
        }
        visible.value = false
        text.value = ''
        truncated.value = false
    }

    const measure = () => {
        timer = null
        const selection = window.getSelection()
        const container = options.container()
        if (!selection || selection.isCollapsed || !container) return hide()

        const range = selection.getRangeAt(0)
        // 选区必须整段落在正文里：在标题、评论框、代码块里划词不该弹条
        if (!container.contains(range.commonAncestorContainer)) return hide()

        const raw = selection.toString().replace(/\s+/g, ' ').trim()
        if (raw.length < minLength) return hide()

        const rect = range.getBoundingClientRect()
        // 选区在屏幕外（比如用键盘全选后滚走了）时 rect 全是 0，弹出来只会是一根
        // 贴在左上角的浮条
        if (!rect.width && !rect.height) return hide()

        anchor.top = rect.top
        anchor.left = rect.left + rect.width / 2
        anchor.width = rect.width
        anchor.height = rect.height
        text.value = raw.slice(0, maxLength)
        truncated.value = raw.length > maxLength
        visible.value = true
    }

    const onSelectionChange = () => {
        if (options.enabled && !options.enabled()) return hide()
        if (timer) clearTimeout(timer)
        timer = setTimeout(measure, SHOW_DELAY)
    }

    /**
     * 滚动就收起浮条。
     * 浮条用的是视口坐标，正文一滚它就和选中的那段文字脱节了 ——
     * 停在原地反而像是「选中了别的东西」。
     */
    const onScroll = () => {
        if (visible.value) hide()
    }

    onMounted(() => {
        document.addEventListener('selectionchange', onSelectionChange)
        window.addEventListener('scroll', onScroll, { passive: true })
    })

    onBeforeUnmount(() => {
        if (timer) clearTimeout(timer)
        timer = null
        document.removeEventListener('selectionchange', onSelectionChange)
        window.removeEventListener('scroll', onScroll)
    })

    return { visible, text, truncated, anchor, hide }
}
