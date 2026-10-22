<script setup lang="ts">
    const emit = defineEmits<{
        result: [text: string]
    }>()

    const { t, current } = useLocale()
    const { show } = useToast()

    const speechLang = computed(() =>
        current.value === 'zh' ? 'zh-CN' : 'en-US'
    )

    const { supported, listening, interim, toggle } = useSpeechRecognition({
        lang: speechLang,
        onFinal: text => emit('result', text),
        onError: key => show(t(key), 'error'),
    })
</script>

<template>
    <v-tooltip v-if="supported" location="top">
        <template #activator="{ props }">
            <v-btn
                v-bind="props"
                :icon="listening ? 'mdi-microphone' : 'mdi-microphone-outline'"
                :color="listening ? 'error' : 'primary'"
                variant="text"
                size="small"
                :aria-label="listening ? t('speech_stop') : t('speech_input')"
                :class="{ 'speech-listening': listening }"
                @click="toggle"
            ></v-btn>
        </template>
        <span>{{ listening ? t('speech_stop') : t('speech_input') }}</span>
    </v-tooltip>

    <!--
        实时转写浮条：四个调用点里三处位于 v-text-field 的 #append-inner 插槽，
        把文本塞进插槽会挤压输入框，因此改为跟随视口的浮层。
        浮层自身不接收指针事件，不会挡住下面的按钮。
    -->
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
    .speech-listening {
        animation: speech-pulse 1.4s ease-in-out infinite;
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
