<script setup lang="ts">
    /**
     * 语音实时转写浮条。
     *
     * 为什么不放在按钮旁边：几个调用点分别位于 v-text-field 的 #append-inner 插槽、
     * 以及 TinyMCE 的工具栏里，把文本塞进这些位置会挤压布局，所以改成跟随视口的浮层。
     * 浮层自身不接收指针事件，不会挡住下面的按钮。
     */
    interface Props {
        listening: boolean
        interim?: string
    }

    defineProps<Props>()
    const { t } = useLocale()
</script>

<template>
    <ClientOnly>
        <Teleport to="body">
            <Transition name="speech-live">
                <div
                    v-if="listening"
                    class="speech-live"
                    role="status"
                    aria-live="polite"
                >
                    <span class="speech-live__dot" aria-hidden="true"></span>
                    <span class="speech-live__text">{{
                        interim || t('speech_listening')
                    }}</span>
                </div>
            </Transition>
        </Teleport>
    </ClientOnly>
</template>

<style scoped>
    .speech-live {
        position: fixed;
        left: 50%;
        bottom: 1.75rem;
        z-index: 2600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        max-width: min(78vw, 30rem);
        padding: 0.5rem 0.9rem;
        border-radius: 999px;
        background: rgba(17, 17, 17, 0.92);
        color: #fff;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        transform: translateX(-50%);
        pointer-events: none;
    }

    .speech-live__dot {
        flex: 0 0 auto;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ff6b6b;
        animation: speech-pulse 1.4s ease-in-out infinite;
    }

    .speech-live__text {
        font-size: 0.8125rem;
        line-height: 1.5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    @keyframes speech-pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.4;
        }
    }

    .speech-live-enter-active,
    .speech-live-leave-active {
        transition:
            opacity 0.18s ease,
            transform 0.18s ease;
    }

    .speech-live-enter-from,
    .speech-live-leave-to {
        opacity: 0;
        transform: translate(-50%, 0.5rem);
    }
</style>
