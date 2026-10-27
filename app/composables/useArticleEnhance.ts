/**
 * 文章正文的「增强层」：目录、代码块复制、图片灯箱、阅读进度。
 *
 * 这四件事本质上都是对**渲染后 HTML 的 DOM 后处理**，和取数、SEO 无关。
 * 之前它们全堆在 `pages/article/[id].vue` 里（那个文件因此长到 1000 行），
 * 抽出来之后任何渲染正文的地方都能复用，页面只负责布局。
 *
 * 约定：所有 DOM 操作必须幂等 —— 正文重新渲染（水合完成 / 切主题 / 换文章）
 * 都会重复调用 `rebuild()`。
 */
export interface TocItem {
    id: string
    text: string
    level: number
}

export interface UseArticleEnhanceOptions {
    /** 渲染后的正文 HTML：变化后自动重建目录与复制按钮 */
    html: () => string | undefined
    /** 目录跳转时给吸顶导航留的高度 */
    appBarHeight?: number
}

/** 滚动高亮的判定偏移：标题顶部进入这个范围就算「当前」 */
const HEADING_OFFSET = 120

const COPY_ICON = '<i class="mdi mdi-content-copy"></i>'
const COPIED_ICON = '<i class="mdi mdi-check"></i>'

/** 复制文本：优先 Clipboard API，非安全上下文（http）降级到 execCommand */
export const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
    }
}

export const useArticleEnhance = (options: UseArticleEnhanceOptions) => {
    const { t } = useLocale()
    const { soundTick } = useSound()

    const toc = ref<TocItem[]>([])
    const activeId = ref('')
    const progress = ref(0)
    const indicator = reactive({ top: 0, height: 0 })

    const markdownRef = useTemplateRef<HTMLElement>('markdownRef')
    const tocNavRef = useTemplateRef<HTMLElement>('tocNavRef')
    let headingEls: HTMLElement[] = []

    // --- 目录 ---
    const buildToc = () => {
        const container = markdownRef.value
        if (!container) return
        const headings = container.querySelectorAll('h1, h2, h3, h4')
        const items: TocItem[] = []
        headings.forEach((el, i) => {
            const id = `heading-${i}`
            el.id = id
            items.push({
                id,
                text: el.textContent?.trim() || '',
                level: Number(el.tagName[1]),
            })
        })
        toc.value = items.filter(item => item.text)
        headingEls = Array.from(headings) as HTMLElement[]
    }

    // 指示条跟随 + 目录自动滚动
    watch(activeId, id => {
        const nav = tocNavRef.value
        if (!nav) return
        const el = nav.querySelector<HTMLElement>(`[data-toc-id="${id}"]`)
        if (!el) return
        indicator.top = el.offsetTop
        indicator.height = el.offsetHeight
        // 保持活动项在目录可视区域内
        const navRect = nav.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        if (elRect.top < navRect.top || elRect.bottom > navRect.bottom) {
            nav.scrollTo({
                top: el.offsetTop - nav.clientHeight / 2,
                behavior: 'smooth',
            })
        }
    })

    // 滚动：阅读进度 + 标题高亮
    const onScroll = () => {
        const doc = document.documentElement
        const scrollTop = doc.scrollTop
        const total = doc.scrollHeight - doc.clientHeight
        progress.value = total > 0 ? (scrollTop / total) * 100 : 0

        // 找到最后一个 top <= scrollTop + offset 的标题
        let current = ''
        for (const el of headingEls) {
            if (el.offsetTop <= scrollTop + HEADING_OFFSET) {
                current = el.id
            } else {
                break
            }
        }
        if (current && current !== activeId.value) {
            activeId.value = current
        }
    }

    const scrollToHeading = (id: string) => {
        activeId.value = id
        const el = document.getElementById(id)
        if (!el) return
        const offset = options.appBarHeight ?? 80
        const top = el.getBoundingClientRect().top + window.scrollY - offset
        window.scrollTo({ top, behavior: 'smooth' })
    }

    // --- 代码块一键复制 ---
    // 为正文中每个 <pre> 注入复制按钮（幂等，可重复调用）
    const enhanceCodeBlocks = () => {
        const container = markdownRef.value
        if (!container) return
        container.querySelectorAll('pre').forEach(pre => {
            if (pre.querySelector(':scope > .code-copy-btn')) return
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'code-copy-btn'
            btn.setAttribute('title', t('copy_code'))
            btn.innerHTML = COPY_ICON
            pre.appendChild(btn)
        })
    }

    // 事件委托处理复制，避免逐个按钮绑监听
    const onCodeCopy = async (e: Event) => {
        const node = e.target as Element
        const btn = node?.closest?.('.code-copy-btn')
        if (!btn) return
        const code =
            btn.closest('pre')?.querySelector('code')?.textContent ?? ''
        await copyToClipboard(code)
        btn.classList.add('code-copied')
        btn.innerHTML = COPIED_ICON
        soundTick()
        window.setTimeout(() => {
            btn.classList.remove('code-copied')
            btn.innerHTML = COPY_ICON
        }, 1500)
    }

    // --- 正文图片 Lightbox ---
    const lightboxVisible = ref(false)
    const lightboxImages = ref<{ src: string; caption?: string }[]>([])
    const lightboxIndex = ref(0)

    // 事件委托：点正文 <img> 收集全部图片并打开预览
    const onImageClick = (e: Event) => {
        const node = e.target as Element
        const img = node?.closest?.(
            '.markdown-body img'
        ) as HTMLImageElement | null
        if (!img) return
        const container = markdownRef.value
        if (!container) return
        const imgs = Array.from(container.querySelectorAll('img'))
        const idx = imgs.indexOf(img)
        lightboxImages.value = imgs.map(el => ({
            src: el.getAttribute('src') || el.currentSrc || '',
            caption: el.getAttribute('alt') || '',
        }))
        lightboxIndex.value = idx >= 0 ? idx : 0
        if (lightboxImages.value.length) lightboxVisible.value = true
    }

    /**
     * 正文重新渲染后重建目录与复制按钮。
     * 注意：这里不要再调 `onScroll()`。它在 nextTick 里跑，此时新正文还没完成布局，
     * 标题的 offsetTop 全是 0，会把 activeId 误判成靠后的某一节。
     */
    const rebuild = () => {
        nextTick(() => {
            buildToc()
            enhanceCodeBlocks()
        })
    }

    watch(() => options.html(), rebuild)

    onMounted(() => {
        rebuild()
        markdownRef.value?.addEventListener('click', onCodeCopy)
        markdownRef.value?.addEventListener('click', onImageClick)
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
    })

    onUnmounted(() => {
        markdownRef.value?.removeEventListener('click', onCodeCopy)
        markdownRef.value?.removeEventListener('click', onImageClick)
        window.removeEventListener('scroll', onScroll)
    })

    return {
        markdownRef,
        tocNavRef,
        toc,
        activeId,
        progress,
        indicator,
        scrollToHeading,
        lightboxVisible,
        lightboxImages,
        lightboxIndex,
        rebuild,
    }
}
