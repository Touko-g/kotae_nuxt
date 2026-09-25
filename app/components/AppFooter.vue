<script setup lang="ts">
    const { t } = useLocale()

    const year = new Date().getFullYear()

    const backToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }
</script>

<template>
    <footer class="k-footer bg-surface">
        <!-- 低速跑马灯：内容重复两份实现无缝循环 -->
        <div
            class="marquee marquee--slow k-footer__marquee py-3"
            aria-hidden="true"
        >
            <div class="marquee-track">
                <template v-for="dup in 2" :key="dup">
                    <span
                        v-for="n in 8"
                        :key="`${dup}-${n}`"
                        class="k-footer__marquee-item"
                    >
                        ✦ {{ t('hero_tagline') }} ✦ Kotae
                    </span>
                </template>
            </div>
        </div>
        <div
            class="k-footer__inner mx-auto d-flex flex-column flex-sm-row align-center justify-space-between pa-6 ga-4"
        >
            <div class="d-flex align-center ga-3">
                <span class="text-h6 font-weight-bold k-gradient-text">
                    Kotae
                </span>
                <span class="text-caption text-medium-emphasis">
                    © {{ year }}
                </span>
            </div>
            <p class="text-overline text-primary font-weight-bold">
                ✦ {{ t('hero_tagline') }} ✦
            </p>
            <v-btn
                color="primary"
                variant="flat"
                size="small"
                append-icon="mdi-arrow-up"
                @click="backToTop"
            >
                {{ t('back_to_top') }}
            </v-btn>
        </div>
    </footer>
</template>

<style scoped></style>
