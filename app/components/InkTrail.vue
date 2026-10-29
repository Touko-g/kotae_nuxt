<script setup lang="ts">
    /**
     * 光标墨迹的画布。
     *
     * 挂在布局里而不是文章页：整站都能拖出墨来才像个彩蛋，
     * 只在一片页面上出现反而像 bug。编辑器除外 —— 那儿的鼠标是在选文字、
     * 拖代码块，再叠一层墨迹纯属添乱。
     */
    const canvasRef = ref<HTMLCanvasElement | null>(null)
    const { current } = useTheme()
    const route = useRoute()

    /** 带不带语言前缀都要认：/article/create、/zh/article/edit/12 */
    const EDITOR_ROUTE = /\/article\/(?:create|edit)(?:\/|$)/

    /**
     * 墨迹总开关，当前是**关**的：先不上线。
     *
     * 留成常量而不是直接写 `enabled: () => false`，一是这个开关迟早要再动，
     * 二是别把下面那条编辑器规则一起删掉 —— 打开时忘了它，编辑区里选文字
     * 就会拖出一道墨。
     */
    const INK_ENABLED = false

    useInkTrail(canvasRef, {
        // 用主题主色，三套主题各自成色（浅红 / 草绿 / 终端绿）
        color: () => current.value.colors.primary,
        // 编辑器里关掉：那儿的鼠标是在选文字、拖代码块，再叠一层墨迹纯属添乱
        enabled: () => INK_ENABLED && !EDITOR_ROUTE.test(route.path),
    })
</script>

<template>
    <canvas ref="canvasRef" class="k-ink-trail" aria-hidden="true" />
</template>

<style scoped>
    /*
     * 铺满视口但不吃事件。z-index 只取 5：正文没有 z-index，墨迹自然浮在上面；
     * 抽屉、顶栏、弹窗都自带更高的层级，墨迹不会糊到它们身上。
     */
    .k-ink-trail {
        position: fixed;
        inset: 0;
        z-index: 5;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }
</style>
