<script setup lang="ts">
    /**
     * 「发现新版本」提示。
     *
     * registerType 用的是 'prompt'：新 Service Worker 装好后会停在 waiting 状态，
     * 不主动接管页面 —— 用户可能正在编辑器里写草稿，直接 reload 会把内容冲掉。
     * 所以刷新的决定权必须交回给用户，由这里调用 updateServiceWorker(true)
     * 触发 skipWaiting + 重载；不调用的话用户会一直停留在旧版本。
     *
     * $pwa 由 @vite-pwa/nuxt 的 client-only 插件注入，SSR 阶段是 undefined。
     * 这里不用 computed 直接读它：首次求值时若插件还没就绪，undefined 会被缓存住，
     * 之后再也不会变。改成 onMounted 里拿一次、再手动桥接成本地 ref，
     * 顺带避免 SSR 渲染出 false、客户端水合成 true 的失配。
     */
    const { t } = useLocale()
    const { show } = useToast()
    const { name: themeName } = useTheme()

    const needRefresh = ref(false)
    const updating = ref(false)

    onMounted(() => {
        const pwa = useNuxtApp().$pwa
        if (!pwa) return

        needRefresh.value = pwa.needRefresh
        watch(
            () => pwa.needRefresh,
            value => {
                needRefresh.value = value
            }
        )

        // 首次预缓存完成时提示一次「可离线阅读」：这是唯一能告诉用户离线已生效的时机，
        // 之后 SW 不会再触发 offlineReady，不会重复打扰
        watch(
            () => pwa.offlineReady,
            ready => {
                if (ready) show(t('pwa_offline_ready'), 'success')
            },
            { immediate: true }
        )
    })

    const update = async () => {
        const pwa = useNuxtApp().$pwa
        if (!pwa || updating.value) return
        updating.value = true
        try {
            // true = 新 SW 激活后立刻重载页面，用户不用再手动刷一次
            await pwa.updateServiceWorker(true)
        } finally {
            updating.value = false
        }
    }

    const later = () => {
        // 只清掉本次提示：waiting 中的 SW 还在，下次进站会再提示一次
        needRefresh.value = false
        useNuxtApp().$pwa?.cancelPrompt()
    }
</script>

<template>
    <Teleport to="body">
        <!-- Teleport 到 body 后不在 .v-application 里，主题 token 要自己带 -->
        <div
            v-if="needRefresh"
            class="k-pwa-prompt"
            :class="`v-theme--${themeName}`"
            role="status"
            aria-live="polite"
            :aria-label="t('pwa_update_title')"
        >
            <i class="mdi mdi-package-down k-pwa-icon" aria-hidden="true"></i>
            <div class="k-pwa-text">
                <strong class="k-pwa-title">{{ t('pwa_update_title') }}</strong>
                <span class="k-pwa-desc">{{ t('pwa_update_desc') }}</span>
            </div>
            <div class="k-pwa-actions">
                <button type="button" class="k-pwa-btn" @click="later">
                    {{ t('pwa_update_later') }}
                </button>
                <button
                    type="button"
                    class="k-pwa-btn k-pwa-btn--main"
                    :disabled="updating"
                    @click="update"
                >
                    {{ updating ? t('pwa_update_doing') : t('pwa_update_now') }}
                </button>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
    .k-pwa-prompt {
        position: fixed;
        left: 50%;
        bottom: 1.75rem;
        z-index: 2700;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: calc(100vw - 24px);
        padding: 10px 12px 10px 14px;
        border: 2px solid rgba(var(--v-theme-on-surface), 0.9);
        border-radius: 14px;
        background: rgb(var(--v-theme-surface));
        box-shadow: 4px 4px 0 rgba(var(--v-theme-on-surface), 0.9);
        transform: translateX(-50%);
        animation: k-pwa-in 0.22s ease-out;
    }

    /* 和朗读浮条抢同一个位置：朗读条在场时自动抬上去，别互相压住。
       整条选择器都放进 :global() —— 写成 `:global(body:has(...)) .k-pwa-prompt`
       的话，Vue 的作用域编译会把尾随的 .k-pwa-prompt 吃掉，规则变成给 body 设
       bottom，等于没写。 */
    :global(body:has(.k-tts-bar) .k-pwa-prompt) {
        bottom: 5.75rem;
    }

    .k-pwa-icon {
        flex: 0 0 auto;
        font-size: 20px;
        color: rgb(var(--v-theme-primary));
    }

    .k-pwa-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
    }

    .k-pwa-title {
        font-size: 13px;
        font-weight: 700;
        color: rgb(var(--v-theme-on-surface));
        white-space: nowrap;
    }

    .k-pwa-desc {
        font-size: 12px;
        line-height: 1.35;
        color: rgba(var(--v-theme-on-surface), 0.6);
    }

    .k-pwa-actions {
        display: flex;
        flex: 0 0 auto;
        gap: 6px;
        margin-left: 4px;
    }

    .k-pwa-btn {
        padding: 6px 12px;
        border: 2px solid rgba(var(--v-theme-on-surface), 0.9);
        border-radius: 999px;
        background: transparent;
        color: rgb(var(--v-theme-on-surface));
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
        transition:
            background-color 0.15s ease,
            opacity 0.15s ease;
    }

    .k-pwa-btn:hover {
        background: rgba(var(--v-theme-on-surface), 0.08);
    }

    .k-pwa-btn--main {
        background: rgb(var(--v-theme-primary));
        border-color: rgba(var(--v-theme-on-surface), 0.9);
        color: rgb(var(--v-theme-on-primary));
    }

    .k-pwa-btn--main:hover {
        background: rgb(var(--v-theme-primary));
        opacity: 0.88;
    }

    .k-pwa-btn:disabled {
        opacity: 0.6;
        cursor: default;
    }

    @keyframes k-pwa-in {
        from {
            opacity: 0;
            transform: translate(-50%, 10px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }

    @media (max-width: 600px) {
        .k-pwa-prompt {
            gap: 8px;
            padding: 9px 10px 9px 12px;
        }

        .k-pwa-desc {
            display: none;
        }

        .k-pwa-btn {
            padding: 6px 10px;
        }
    }
</style>
