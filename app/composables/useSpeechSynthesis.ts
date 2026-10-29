/**
 * 正文朗读（浏览器原生 SpeechSynthesis）。
 *
 * 为什么按段落念而不是整篇一次读完：
 * 1. 上游的 `SpeechSynthesisUtterance` 对超长文本支持并不好，Chrome 上长句会中途
 *    无声停止，切成段落天然规避；
 * 2. 只有分段才知道「现在念到哪儿」，才能给当前段落加高亮、跟着滚动。
 *
 * SSR 安全：服务端没有 window.speechSynthesis，`supported` 恒为 false，
 * 所有播放动作在服务端都是空操作。
 */

export interface SpeechSegment {
    /**
     * 这一段的宿主元素，用于加高亮和跟随滚动。
     * `null` = 文字直接写在正文根节点下（没有块级容器可指），不能高亮 ——
     * 给根节点加 class 会把整篇文章涂上底色。
     */
    el: HTMLElement | null
    text: string
}

export interface UseSpeechSynthesisOptions {
    /** 朗读语言，跟随界面语言（zh → zh-CN） */
    lang?: () => string
}

const RATE_KEY = 'tts-rate'

/** 可选语速：0.75 适合听外语，1.5 适合扫读 */
export const TTS_RATES = [0.75, 1, 1.25, 1.5] as const

/** 当前段落的 class，样式在 main.css 里（要作用到正文 DOM，组件 scoped 够不着） */
export const TTS_ACTIVE_CLASS = 'k-tts-active'

/**
 * 可朗读的块级容器：每个文本节点归到「离它最近的那个祖先」成段。
 *
 * 用白名单选择器 + `querySelectorAll` 收集是错的 —— 那样只能捞到认识的标签，
 * 代码块（pre > code）、表格单元格、裸 div 里的文字会整段消失，而文章里
 * 混着编辑器粘贴进来的各种结构。改成「按文本节点归组」后，任何结构都不会漏。
 *
 * `div` / `section` / `summary` 这几个必须在内：AI 生成的 HTML 和从别处粘进来的
 * 内容经常把整段文字直接塞在 `div` 里，`<details><summary>` 的标题也一样。
 * 漏掉它们不会丢字，但那段会兜底到正文根节点 —— 高亮铺满整篇、滚动跳回顶部。
 * 有 `<p>` 包着时仍是 `<p>` 优先（从文本节点往上找，先命中的那个胜出）。
 */
const BLOCK_SELECTOR = [
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'blockquote',
    'pre',
    'td',
    'th',
    'dt',
    'dd',
    'figcaption',
    'caption',
    'div',
    'section',
    'aside',
    'summary',
    'figure',
    'label',
].join(',')

/**
 * 单次 utterance 的字数上限。
 * Chrome 对过长的句子会念到一半静默停下，而且 onend 不一定触发 ——
 * 整段一次性丢进去，后半篇就再也不出声了。按句末标点切开更稳。
 */
const MAX_CHUNK = 100

/** 保活心跳：超过约 15 秒的 utterance 在部分浏览器上会静默超时，踹它一下 */
const KEEP_ALIVE_MS = 12000

/**
 * `cancel()` 之后隔多久再开口。
 *
 * 被取消的 utterance 的 onend / onerror 是**异步**回来的，`cancel()` 与 `speak()`
 * 挤在同一轮事件循环里时，新 utterance 偶尔拿不到 onend —— 推进链就断在这一句上。
 * 表现正是「改完倍速，当前这段念完就没声了」。让出一轮再开口，几十毫秒人耳无感。
 */
const CANCEL_SETTLE_MS = 60

/** 断链看门狗的巡检间隔 */
const STALL_CHECK_MS = 1000

/** 连续被看门狗救回来的次数上限：超过说明引擎真的坏了，停下比乱跳好 */
const MAX_STALLS = 2

export const useSpeechSynthesis = (options: UseSpeechSynthesisOptions = {}) => {
    const supported = ref(false)
    const speaking = ref(false)
    const paused = ref(false)
    const rate = ref(1)
    /** 正在念第几段（从 0 开始），停止后回到 -1 */
    const index = ref(-1)
    const total = ref(0)

    let segments: SpeechSegment[] = []
    /** 正文根节点，重新收集段落时要用 */
    let root: HTMLElement | null = null
    let voices: SpeechSynthesisVoice[] = []
    let highlighted: HTMLElement | null = null
    /** 保活心跳的定时器，停止朗读时清掉 */
    let keepAliveTimer: ReturnType<typeof setInterval> | null = null
    /** 看门狗定时器 */
    let stallTimer: ReturnType<typeof setInterval> | null = null
    /** cancel 之后推迟开口的定时器；这段时间引擎是空的，看门狗不许插手 */
    let restartTimer: ReturnType<typeof setTimeout> | null = null
    /** 连续被看门狗救回来的次数，正常念完一句就清零 */
    let stalls = 0
    /**
     * 念到哪一段的第几句。
     * 改语速必须从这里续，而不是从段首重来 —— 一段可能上千字（被切成十几句），
     * 整段重念等于让用户倒带半分钟。
     */
    let activeSegment = 0
    let activePiece = 0
    /**
     * 每次开始 / 停止 / 跳段都递增。
     * `cancel()` 会触发上一段 utterance 的 onerror('interrupted') 与 onend，
     * 旧回调据此判断自己已经过期 —— 否则一次取消会连着把朗读推进到下一段。
     */
    let run = 0

    const loadVoices = () => {
        if (!import.meta.client) return
        voices = window.speechSynthesis.getVoices()
    }

    const resolveLang = () => options.lang?.() || 'zh-CN'

    /** 同语言里优先本地语音：不依赖网络，停顿更少 */
    const pickVoice = (lang: string) => {
        const prefix = lang.slice(0, 2).toLowerCase()
        const matched = voices.filter(voice =>
            voice.lang.replace('_', '-').toLowerCase().startsWith(prefix)
        )
        if (!matched.length) return null
        return matched.find(voice => voice.localService) ?? matched[0]
    }

    const highlight = (el: HTMLElement | null) => {
        highlighted?.classList.remove(TTS_ACTIVE_CLASS)
        highlighted = el
        el?.classList.add(TTS_ACTIVE_CLASS)
    }

    /**
     * 收集可朗读的段落。
     *
     * 按**文本节点**遍历，每个节点归到离它最近的块级祖先：
     * - 段落里的加粗、链接、行内代码不会把一句话拆成几段（它们不匹配选择器，
     *   一路向上找到 <p>）；
     * - 嵌套结构不会丢字 —— `li` 里套 `ul` 时，外层 li 自己的文字归外层、
     *   内层归内层，两边都在；
     * - 代码块、表格单元格、裸 div 也都在候选里，不会再整段消失。
     *
     * 连续属于同一个块的文本节点会合并成一段，所以「一段 = 一次高亮」。
     */
    const collect = (container: HTMLElement): SpeechSegment[] => {
        const list: SpeechSegment[] = []
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT
        )
        let currentEl: HTMLElement | null = null
        let buffer = ''

        const flush = () => {
            const text = buffer.replace(/\s+/g, ' ').trim()
            if (text && currentEl) {
                // 兜底到根节点的那一段不带元素：高亮和跟随滚动都跳过它
                list.push({
                    el: currentEl === container ? null : currentEl,
                    text,
                })
            }
            buffer = ''
        }

        let node = walker.nextNode()
        while (node) {
            const parent = node.parentElement
            // 装饰性/隐藏内容不该被念出来（有的文章会塞 aria-hidden 的图标文字）
            if (parent && !parent.closest('[aria-hidden="true"]')) {
                let block: HTMLElement | null = parent
                while (
                    block &&
                    block !== container &&
                    !block.matches(BLOCK_SELECTOR)
                ) {
                    block = block.parentElement
                }
                const target = block && block !== container ? block : container

                if (target !== currentEl) {
                    flush()
                    currentEl = target
                }
                buffer += node.textContent || ''
            }
            node = walker.nextNode()
        }
        flush()

        return list
    }

    /** 把长段落按句末标点切开，找不到标点就硬切 */
    const splitText = (text: string): string[] => {
        if (text.length <= MAX_CHUNK) return [text]

        const pieces: string[] = []
        let rest = text
        while (rest.length > MAX_CHUNK) {
            let cut = -1
            // 只在后半段找标点，避免切出一堆两三个字的碎片
            const floor = Math.floor(MAX_CHUNK * 0.6)
            const ceiling = Math.min(rest.length - 1, MAX_CHUNK + 20)
            for (let i = ceiling; i >= floor; i--) {
                if ('。！？；.!?;'.includes(rest[i]!)) {
                    cut = i + 1
                    break
                }
            }
            if (cut <= 0) cut = MAX_CHUNK
            pieces.push(rest.slice(0, cut).trim())
            rest = rest.slice(cut)
        }
        const tail = rest.trim()
        if (tail) pieces.push(tail)
        return pieces.filter(Boolean)
    }

    const stopKeepAlive = () => {
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer)
            keepAliveTimer = null
        }
    }

    /**
     * 保活心跳。
     *
     * 部分浏览器（尤其 Windows 上的 Chrome）对超过约 15 秒的 utterance 会静默停下，
     * 而且 onend 不一定触发 —— 表现就是「念到一半，后面全没了」。
     * 定期 pause + resume 能把引擎踹醒；分句已经让单句变短，这是第二道保险。
     */
    const startKeepAlive = () => {
        stopKeepAlive()
        keepAliveTimer = setInterval(() => {
            if (!speaking.value || paused.value) return
            window.speechSynthesis.pause()
            window.speechSynthesis.resume()
        }, KEEP_ALIVE_MS)
    }

    /**
     * 清空队列并把引擎复位到 running。
     *
     * `cancel()` 只清队列，**不会清掉 paused 标志** —— 在暂停状态下 cancel 再 speak，
     * 新加的 utterance 会静默不出声。表现就是「点了倍速 / 跳段之后没声音了」。
     */
    const resetEngine = () => {
        window.speechSynthesis.cancel()
        if (window.speechSynthesis.paused) window.speechSynthesis.resume()
        paused.value = false
    }

    const stopWatchdog = () => {
        if (stallTimer) {
            clearInterval(stallTimer)
            stallTimer = null
        }
    }

    /**
     * 断链看门狗。
     *
     * `onend` 是这条链唯一的推进信号，丢一次整篇就停在那一句上。Chrome 在
     * cancel 之后、以及偶尔在长句末尾，都会漏发 onend。判据很干净：
     * 「我们以为还在念，但引擎既没在响也没有待播」—— 那就是漏事件，
     * 从下一句接着念（越界时 speakPiece 自己会推进到下一段）。
     *
     * 暂停中不算：pause 会让引擎看起来是空的。cancel 之后那几十毫秒也不算，
     * 由 restartTimer 挡着。连续救超过 MAX_STALLS 次说明引擎已经坏了，
     * 再救下去只会飞快跳过正文，不如停下让用户重来。
     */
    const startWatchdog = () => {
        stopWatchdog()
        stallTimer = setInterval(() => {
            if (!speaking.value || paused.value || restartTimer) return
            const engine = window.speechSynthesis
            if (engine.paused || engine.speaking || engine.pending) return

            stalls += 1
            if (stalls > MAX_STALLS) return stop()

            run += 1
            speakAt(activeSegment, activePiece + 1)
        }, STALL_CHECK_MS)
    }

    /**
     * 换段 / 改语速统一走这里：先 cancel，隔一拍再开口。
     *
     * 不隔这一拍的话，cancel 的异步回调会和新 utterance 的 onend 抢，
     * 新 utterance 偶尔永远等不到 onend —— 就是「改完倍速，这段念完就没声了」。
     */
    const restartAt = (i: number, from = 0) => {
        if (restartTimer) {
            clearTimeout(restartTimer)
            restartTimer = null
        }
        run += 1
        resetEngine()
        restartTimer = setTimeout(() => {
            restartTimer = null
            if (!speaking.value) return
            speakAt(i, from)
            // 这一拍里用户点了暂停：先把声音挂起，别出现「显示暂停却在响」
            if (paused.value) window.speechSynthesis.pause()
        }, CANCEL_SETTLE_MS)
    }

    const stop = () => {
        if (!import.meta.client) return
        run += 1
        if (restartTimer) {
            clearTimeout(restartTimer)
            restartTimer = null
        }
        stopKeepAlive()
        stopWatchdog()
        resetEngine()
        speaking.value = false
        paused.value = false
        index.value = -1
        total.value = 0
        segments = []
        root = null
        activeSegment = 0
        activePiece = 0
        stalls = 0
        highlight(null)
    }

    /**
     * 正文被整块替换后，按序号把段落重新绑到新 DOM 上。
     *
     * 换主题会重算 `renderedHtml`（代码块要换 Shiki 配色），`v-html` 把整棵子树
     * 重建，段落里存的老元素全部脱离文档 —— 表现是「朗读还在继续，但高亮没了、
     * 也不再跟着滚动」。正文没变时两次收集的块数一致，按序号重绑即可；
     * 块数变了（正文真的换了）就不动，宁可丢高亮也别把朗读指到错误的段落。
     */
    const rebind = () => {
        if (!root) return
        const fresh = collect(root)
        if (fresh.length === segments.length) segments = fresh
    }

    const speakAt = (i: number, from = 0) => {
        if (i < 0 || i >= segments.length) return stop()

        const stale = segments[i]!.el
        if (stale && !stale.isConnected) rebind()

        const segment = segments[i]!
        index.value = i
        if (segment.el) {
            highlight(segment.el)
            // 只有真正换段才滚动。from > 0 是「同一段从句中续读」（改语速走这条路），
            // 这时把人拽回段中间纯属添乱
            if (from === 0) {
                segment.el.scrollIntoView({
                    block: 'center',
                    behavior: 'smooth',
                })
            }
        } else {
            // 没有块级容器可以高亮：只清掉上一段的高亮，别把整篇涂色
            highlight(null)
        }

        const pieces = splitText(segment.text)
        const token = run

        /**
         * 一段可能被切成多句，全部念完才推进到下一段。
         * 对外 `index` / `total` 仍然是段落序号 —— 切句是引擎层面的细节，
         * UI 上不该看到「第 37 / 120 句」。
         */
        const speakPiece = (k: number) => {
            if (token !== run || !speaking.value) return
            if (k >= pieces.length) return speakAt(i + 1)

            activeSegment = i
            activePiece = k

            const utterance = new SpeechSynthesisUtterance(pieces[k]!)
            const lang = resolveLang()
            utterance.lang = lang
            const voice = pickVoice(lang)
            if (voice) utterance.voice = voice
            utterance.rate = rate.value

            utterance.onend = () => {
                // 正常念完一句，把看门狗的计数清零
                stalls = 0
                speakPiece(k + 1)
            }
            utterance.onerror = event => {
                // interrupted / canceled 是我们自己 cancel 出来的，不是失败
                if (
                    event.error === 'interrupted' ||
                    event.error === 'canceled'
                ) {
                    return
                }
                // 单句失败（个别语种缺音色等）跳过就好，别让整篇卡死在这一句
                speakPiece(k + 1)
            }

            window.speechSynthesis.speak(utterance)
        }

        speakPiece(from)
    }

    /** 开始朗读；返回 false 表示这篇没有可读内容（调用方据此提示） */
    const start = (container: HTMLElement | null | undefined) => {
        if (!import.meta.client || !supported.value || !container) return false
        const list = collect(container)
        if (!list.length) return false

        root = container
        segments = list
        total.value = list.length
        speaking.value = true
        paused.value = false
        activeSegment = 0
        activePiece = 0
        stalls = 0
        startKeepAlive()
        startWatchdog()
        // cancel + speak 不能挤在同一轮事件循环里，统一交给 restartAt
        restartAt(0)
        return true
    }

    const pause = () => {
        if (!speaking.value || paused.value) return
        window.speechSynthesis.pause()
        paused.value = true
    }

    const resume = () => {
        if (!speaking.value || !paused.value) return
        window.speechSynthesis.resume()
        paused.value = false
    }

    const toggle = () => (paused.value ? resume() : pause())

    const jump = (delta: number) => {
        if (!speaking.value) return
        const target = index.value + delta
        if (target < 0) return restartAt(0)
        if (target >= segments.length) return stop()
        restartAt(target)
    }

    /**
     * 改语速。
     *
     * 三条约束，每一条都对应一个实际会踩的坑：
     * 1. **点当前倍速直接返回** —— 否则误触一次，正在听的那段就从头再来；
     * 2. **暂停中只记下新语速，不擅自开始念** —— 用户暂停着调设置，
     *    突然出声比「没反应」更烦人；恢复后当前句仍是旧语速，下一句生效；
     * 3. **重念的粒度是当前句，不是当前段** —— 已创建的 utterance 改不了 rate，
     *    只能重建，但一段可能有上千字（切成十几句），整段重来等于倒带半分钟。
     */
    const setRate = (value: number) => {
        if (value === rate.value) return

        rate.value = value
        try {
            localStorage.setItem(RATE_KEY, String(value))
        } catch {
            // 无痕模式 / 配额满：这次只在内存里生效，不打断朗读
        }

        if (!speaking.value || paused.value) return

        // 从当前句重念，同样要走「cancel → 隔一拍 → 开口」
        stalls = 0
        restartAt(activeSegment, activePiece)
    }

    onMounted(() => {
        supported.value = 'speechSynthesis' in window
        // 读也要兜住：禁用站点存储 / 无痕模式下 getItem 同样会抛，
        // 抛出去就等于 supported 停在 false，按钮变成「不支持语音朗读」
        try {
            const stored = Number(localStorage.getItem(RATE_KEY))
            if (TTS_RATES.includes(stored as (typeof TTS_RATES)[number])) {
                rate.value = stored
            }
        } catch {
            // 用默认 1× 即可
        }
        if (!supported.value) return
        loadVoices()
        // Chrome 首次 getVoices() 返回空数组，语音列表要等这个事件
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    })

    onBeforeUnmount(() => {
        if (!import.meta.client) return
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
        // 组件卸载必须掐掉朗读：换文章后还在念上一篇是明确的 bug
        stop()
    })

    return {
        supported,
        speaking,
        paused,
        rate,
        index,
        total,
        start,
        stop,
        pause,
        resume,
        toggle,
        jump,
        setRate,
    }
}
