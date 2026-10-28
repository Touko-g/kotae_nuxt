<script setup lang="ts">
    /**
     * 朗读按钮 + 控制浮条。
     *
     * 按钮长在文章的操作栏里（和分享、点赞并排），浮条则固定贴在视口底部 ——
     * 朗读是一个「持续一段时间」的状态，控制条得一直在手边，不能跟着页面滚走。
     */
    import { TTS_RATES } from '~/composables/useSpeechSynthesis'

    interface Props {
        /** 正文容器的 getter：组件自己去里面收集段落 */
        container: () => HTMLElement | null | undefined
    }

    const props = defineProps<Props>()

    const { current, t } = useLocale()
    const { show } = useToast()
    const { name: themeName } = useTheme()

    const {
        supported,
        speaking,
        paused,
        rate,
        index,
        total,
        start,
        stop,
        toggle,
        jump,
        setRate,
    } = useSpeechSynthesis({
        lang: () => (current.value === 'zh' ? 'zh-CN' : 'en-US'),
    })

    const handleClick = () => {
        if (speaking.value) return stop()
        if (!supported.value) {
            show(t('tts_unsupported'), 'warning')
            return
        }
        if (!start(props.container())) {
            show(t('tts_empty'), 'warning')
        }
    }
</script>

<template>
    <v-btn
        variant="text"
        :icon="speaking ? 'mdi-stop-circle-outline' : 'mdi-volume-high'"
        :color="speaking ? 'primary' : ''"
        :title="speaking ? t('tts_stop') : t('read_aloud')"
        :aria-label="speaking ? t('tts_stop') : t('read_aloud')"
        data-cuelume-manual
        @click="handleClick"
    />

    <Teleport to="body">
        <!-- 浮条要自己带主题类：Teleport 到 body 后不在 .v-application 里，拿不到主题 token -->
        <div
            v-if="speaking"
            class="k-tts-bar"
            :class="`v-theme--${themeName}`"
            role="group"
            :aria-label="t('read_aloud')"
        >
            <span class="k-tts-count">{{ index + 1 }} / {{ total }}</span>
            <span class="k-tts-sep" aria-hidden="true"></span>
            <button
                type="button"
                class="k-tts-btn"
                :title="t('tts_prev')"
                :aria-label="t('tts_prev')"
                @click="jump(-1)"
            >
                <i class="mdi mdi-skip-previous" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                class="k-tts-btn k-tts-btn--main"
                :title="paused ? t('tts_play') : t('tts_pause')"
                :aria-label="paused ? t('tts_play') : t('tts_pause')"
                @click="toggle"
            >
                <i
                    class="mdi"
                    :class="paused ? 'mdi-play' : 'mdi-pause'"
                    aria-hidden="true"
                ></i>
            </button>
            <button
                type="button"
                class="k-tts-btn"
                :title="t('tts_next')"
                :aria-label="t('tts_next')"
                @click="jump(1)"
            >
                <i class="mdi mdi-skip-next" aria-hidden="true"></i>
            </button>
            <span class="k-tts-sep" aria-hidden="true"></span>
            <div class="k-tts-rates">
                <button
                    v-for="option in TTS_RATES"
                    :key="option"
                    type="button"
                    class="k-tts-rate"
                    :class="{ 'k-tts-rate--on': rate === option }"
                    :title="`${option}× ${t('tts_speed')}`"
                    :aria-label="`${option}× ${t('tts_speed')}`"
                    :aria-pressed="rate === option"
                    @click="setRate(option)"
                >
                    {{ option }}×
                </button>
            </div>
            <span class="k-tts-sep" aria-hidden="true"></span>
            <button
                type="button"
                class="k-tts-btn"
                :title="t('tts_stop')"
                :aria-label="t('tts_stop')"
                @click="stop"
            >
                <i class="mdi mdi-close" aria-hidden="true"></i>
            </button>
        </div>
    </Teleport>
</template>

<style scoped>
    .k-tts-bar {
        position: fixed;
        left: 50%;
        bottom: 1.75rem;
        z-index: 2600;
        display: flex;
        align-items: center;
        gap: 2px;
        max-width: calc(100vw - 24px);
        padding: 6px 10px;
        border-radius: 999px;
        border: 2px solid rgba(var(--v-theme-on-surface), 0.9);
        background: rgb(var(--v-theme-surface));
        box-shadow: 4px 4px 0 rgba(var(--v-theme-on-surface), 0.9);
        transform: translateX(-50%);
        animation: k-tts-in 0.2s ease-out;
    }

    .k-tts-count {
        padding: 0 6px;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: rgba(var(--v-theme-on-surface), 0.55);
        white-space: nowrap;
    }

    .k-tts-sep {
        flex: 0 0 auto;
        width: 1px;
        height: 16px;
        margin: 0 6px;
        background: rgba(var(--v-theme-on-surface), 0.18);
    }

    .k-tts-btn {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: rgb(var(--v-theme-on-surface));
        font-size: 18px;
        cursor: pointer;
        transition:
            background-color 0.15s ease,
            color 0.15s ease;
    }

    .k-tts-btn:hover {
        background: rgba(var(--v-theme-primary), 0.12);
        color: rgb(var(--v-theme-primary));
    }

    .k-tts-btn--main {
        width: 36px;
        height: 36px;
        font-size: 22px;
        background: rgb(var(--v-theme-primary));
        color: rgb(var(--v-theme-on-primary));
    }

    .k-tts-btn--main:hover {
        background: rgb(var(--v-theme-primary));
        color: rgb(var(--v-theme-on-primary));
        opacity: 0.88;
    }

    .k-tts-rates {
        display: flex;
        gap: 1px;
    }

    .k-tts-rate {
        padding: 4px 7px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: rgba(var(--v-theme-on-surface), 0.5);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
        transition:
            background-color 0.15s ease,
            color 0.15s ease;
    }

    .k-tts-rate:hover {
        color: rgb(var(--v-theme-on-surface));
    }

    .k-tts-rate--on {
        background: rgba(var(--v-theme-primary), 0.14);
        color: rgb(var(--v-theme-primary));
        font-weight: 600;
    }

    @keyframes k-tts-in {
        from {
            opacity: 0;
            transform: translate(-50%, 8px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }

    @media (max-width: 600px) {
        .k-tts-bar {
            gap: 0;
            padding: 5px 8px;
        }

        .k-tts-count {
            display: none;
        }

        .k-tts-rate {
            padding: 4px 5px;
            font-size: 11px;
        }
    }
</style>
