import { bind, play } from 'cuelume'

/**
 * 客户端插件：为整个应用的可交互元素启用音效
 *
 * 分两层工作：
 * 1. bind() —— 处理显式声明的 data-cuelume-hover/press/release/toggle 属性，
 *    可为特定元素指定自定义音效（如 data-cuelume-toggle="sparkle"）。
 * 2. 全局事件委托 —— 为所有可交互元素（按钮、链接、列表项、标签、分页等）
 *    自动添加细腻的 press/release 触感音效，无需逐个标注，新增元素也自动生效。
 *
 * 约定：
 * - 已声明任意 data-cuelume-* 属性的元素（含 data-cuelume-manual）会被全局委托跳过，
 *   避免与 bind() 或命令式音效重复播放。
 * - data-cuelume-manual 是一个“仅 opting-out”标记：表示该元素自行管理音效
 *   （命令式调用），全局委托不介入，bind() 也不会为其发声。
 * - 所有播放统一受 setEnabled 控制（见 useSound 的音效开关）。
 */
export default defineNuxtPlugin(() => {
    // 显式声明式绑定（优先级最高，可自定义音效）
    bind()

    if (typeof document === 'undefined') return

    // 需要自动音效的可交互元素选择器
    const INTERACTIVE_SELECTOR = [
        'button',
        'a[href]',
        '[role="button"]',
        '[role="menuitem"]',
        '[role="tab"]',
        '[role="option"]',
        '.v-list-item',
        '.v-chip',
        '.v-tab',
        '.v-pagination__item',
        '.v-switch',
        '.v-checkbox',
        '.v-radio',
        '.v-card--link',
        '.v-expansion-panel-title',
    ].join(',')

    // 显式声明 cuelume 属性的元素交由 bind()/命令式处理，全局委托跳过
    const EXPLICIT_SELECTOR =
        '[data-cuelume-hover],[data-cuelume-press],[data-cuelume-release],[data-cuelume-toggle],[data-cuelume-manual]'

    const isDisabled = (el: Element) =>
        el.matches(
            ':disabled,[aria-disabled="true"],.v-btn--disabled,.v-list-item--disabled,.v-chip--disabled'
        )

    // 按音效类型分别节流，避免快速连续触发时声音堆叠
    const lastPlay: Record<string, number> = {}
    const throttle = (key: string, gap: number) => {
        const now = performance.now()
        if (now - (lastPlay[key] ?? -Infinity) < gap) return false
        lastPlay[key] = now
        return true
    }

    const resolveTarget = (event: Event) => {
        const node = event.target
        if (!(node instanceof Element)) return null
        const el = node.closest(INTERACTIVE_SELECTOR)
        if (!el) return null
        if (isDisabled(el)) return null
        if (el.closest(EXPLICIT_SELECTOR)) return null
        return el
    }

    // 按压：pointerdown（仅左键 / 触摸）
    document.addEventListener(
        'pointerdown',
        event => {
            if (event.button !== 0) return
            if (!resolveTarget(event)) return
            if (!throttle('press', 50)) return
            play('press')
        },
        true
    )

    // 释放：pointerup
    document.addEventListener(
        'pointerup',
        event => {
            if (event.button !== 0) return
            if (!resolveTarget(event)) return
            if (!throttle('release', 50)) return
            play('release')
        },
        true
    )
})
