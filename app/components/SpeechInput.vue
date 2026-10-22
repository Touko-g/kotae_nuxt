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
                :class="{ 'speech-listening': listening }"
                @click="toggle"
            ></v-btn>
        </template>
        <span>{{
            listening ? interim || t('speech_listening') : t('speech_input')
        }}</span>
    </v-tooltip>
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
</style>
