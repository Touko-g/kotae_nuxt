<script setup lang="ts">
    import type { NuxtError } from '#app'

    const props = defineProps<{ error: NuxtError }>()

    const { t } = useI18n()
    const localePath = useLocalePath()

    const statusCode = computed(() => Number(props.error?.statusCode) || 500)
    const isNotFound = computed(() => statusCode.value === 404)

    useHead({
        title: () => `${statusCode.value} · Kotae`,
    })

    const goBack = () => {
        if (import.meta.client && window.history.length > 1) {
            window.history.back()
        } else {
            navigateTo(localePath('/'))
        }
    }
</script>

<template>
    <v-app>
        <v-main class="d-flex align-center justify-center px-4 py-12">
            <v-container
                class="k-hero k-card bg-surface position-relative overflow-hidden rounded-xl pa-8 pa-sm-12 text-center"
                style="max-width: 44rem"
            >
                <!-- 复用首页的花饰 / 极光辉光，保持贴纸插画风一致 -->
                <span class="hero-blob hero-blob--a" aria-hidden="true"></span>
                <span class="hero-blob hero-blob--b" aria-hidden="true"></span>
                <span class="k-doodle k-doodle--ring" aria-hidden="true"></span>
                <span
                    class="k-doodle k-doodle--spark"
                    aria-hidden="true"
                ></span>

                <p class="text-overline text-primary font-weight-bold mb-2">
                    ✦
                    {{
                        isNotFound
                            ? t('error_404_eyebrow')
                            : t('error_server_eyebrow')
                    }}
                </p>
                <h1 class="error-code k-gradient-text anim anim-pop">
                    {{ statusCode }}
                </h1>
                <h2 class="text-h5 font-weight-bold mb-3">
                    {{
                        isNotFound
                            ? t('error_notfound_title')
                            : t('error_server_title')
                    }}
                </h2>
                <p
                    class="text-body-1 text-medium-emphasis mx-auto mb-8"
                    style="max-width: 32rem"
                >
                    {{
                        isNotFound
                            ? t('error_notfound_text')
                            : t('error_server_text')
                    }}
                </p>
                <div
                    class="d-flex justify-center flex-wrap"
                    style="gap: 0.75rem"
                >
                    <v-btn
                        :to="localePath('/')"
                        color="primary"
                        prepend-icon="mdi-home-variant"
                        class="text-none font-weight-bold"
                        size="large"
                    >
                        {{ t('back_home') }}
                    </v-btn>
                    <v-btn
                        variant="tonal"
                        prepend-icon="mdi-arrow-left"
                        class="text-none"
                        size="large"
                        @click="goBack"
                    >
                        {{ t('go_back') }}
                    </v-btn>
                </div>
            </v-container>
        </v-main>
    </v-app>
</template>

<style scoped>
    .error-code {
        font-size: clamp(5rem, 22vw, 11rem);
        line-height: 1;
        font-weight: 800;
        margin-bottom: 1rem;
    }
</style>
