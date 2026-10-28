<script setup lang="ts">
    /**
     * 划词浮条：正文里选中一段文字后，贴着选区冒出来的小动作条。
     *
     * 位置用视口坐标（position: fixed），所以必须 Teleport 到 body ——
     * 留在页面里会被 v-card 的圆角与内边距裁掉，滚动时还会跟着父级偏移。
     * Teleport 出去之后拿不到 `.v-application` 上的主题变量，因此元素自己带上
     * 当前的 `v-theme--*` 类，把 Vuetify 那套 token 重新挂回自己身上。
     */
    interface AskAction {
        key: string
        label: string
        icon: string
    }

    interface Props {
        modelValue: boolean
        /** 选中的原文，用于浮条上的引文预览 */
        text: string
        anchor: { top: number; left: number; width: number; height: number }
        actions: AskAction[]
    }

    const props = defineProps<Props>()
    const emit = defineEmits<{
        select: [key: string]
    }>()

    const { name: themeName } = useTheme()

    /** 浮条宽度的一半，用来把浮条夹在视口里 */
    const BAR_HALF = 172

    const preview = computed(() => {
        const text = props.text.replace(/\s+/g, ' ').trim()
        return text.length > 28 ? `${text.slice(0, 28)}…` : text
    })

    const positionStyle = computed(() => {
        if (!import.meta.client) return {}
        const vw = window.innerWidth
        const half = Math.min(BAR_HALF, vw / 2 - 8)
        const left = Math.min(Math.max(props.anchor.left, half), vw - half)
        // 上方放得下就贴在选区上面，否则翻到下方
        const top =
            props.anchor.top > 92
                ? props.anchor.top - 52
                : props.anchor.top + props.anchor.height + 12
        return { left: `${left}px`, top: `${top}px` }
    })
</script>

<template>
    <Teleport to="body">
        <!--
            整个浮条都阻止默认的 mousedown：按下按钮的瞬间浏览器会把选区收起，
            selectionchange 一触发，浮条就自己消失了 —— 点击落在空气里。
        -->
        <div
            v-if="modelValue && text"
            class="k-ask-bar"
            :class="`v-theme--${themeName}`"
            :style="positionStyle"
            @mousedown.prevent
        >
            <span class="k-ask-quote">{{ preview }}</span>
            <span class="k-ask-divider" aria-hidden="true"></span>
            <button
                v-for="action in actions"
                :key="action.key"
                type="button"
                class="k-ask-btn"
                @mousedown.prevent
                @click="emit('select', action.key)"
            >
                <i class="mdi" :class="action.icon" aria-hidden="true"></i>
                {{ action.label }}
            </button>
        </div>
    </Teleport>
</template>

<style scoped>
    .k-ask-bar {
        position: fixed;
        z-index: 2400;
        display: flex;
        align-items: center;
        gap: 2px;
        max-width: calc(100vw - 16px);
        padding: 5px 8px;
        border-radius: 999px;
        border: 2px solid rgba(var(--v-theme-on-surface), 0.9);
        background: rgb(var(--v-theme-surface));
        box-shadow: 3px 3px 0 rgba(var(--v-theme-on-surface), 0.9);
        transform: translateX(-50%);
        animation: k-ask-in 0.16s ease-out;
    }

    .k-ask-quote {
        max-width: 128px;
        padding: 0 6px 0 4px;
        overflow: hidden;
        font-size: 12px;
        line-height: 1.4;
        color: rgba(var(--v-theme-on-surface), 0.55);
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .k-ask-divider {
        flex: 0 0 auto;
        width: 1px;
        height: 16px;
        margin: 0 4px;
        background: rgba(var(--v-theme-on-surface), 0.18);
    }

    .k-ask-btn {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: rgb(var(--v-theme-on-surface));
        font-size: 13px;
        line-height: 1.2;
        cursor: pointer;
        transition:
            background-color 0.15s ease,
            color 0.15s ease;
    }

    .k-ask-btn .mdi {
        font-size: 15px;
        opacity: 0.85;
    }

    .k-ask-btn:hover {
        background: rgba(var(--v-theme-primary), 0.12);
        color: rgb(var(--v-theme-primary));
    }

    .k-ask-btn:active {
        background: rgba(var(--v-theme-primary), 0.2);
    }

    @keyframes k-ask-in {
        from {
            opacity: 0;
            transform: translate(-50%, 4px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }
</style>
