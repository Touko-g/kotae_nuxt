<script setup lang="ts">
    export interface LightboxImage {
        src: string
        caption?: string
    }

    interface Props {
        modelValue: boolean
        images: LightboxImage[]
        start?: number
    }
    const props = withDefaults(defineProps<Props>(), { start: 0 })
    const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

    const { t } = useLocale()

    const index = ref(0)
    const zoom = ref(1)
    const rotation = ref(0)
    const offset = reactive({ x: 0, y: 0 })
    const dragging = ref(false)
    const dragStart = reactive({ x: 0, y: 0 })
    const loading = ref<boolean[]>([])

    const visible = computed({
        get: () => props.modelValue,
        set: v => emit('update:modelValue', v),
    })

    const resetTransform = () => {
        zoom.value = 1
        rotation.value = 0
        offset.x = 0
        offset.y = 0
    }
    const resetZoom = resetTransform

    const normalizeAngle = (deg: number) => {
        const angle = ((deg % 360) + 360) % 360
        return angle > 180 ? angle - 360 : angle
    }
    const rotateBy = (delta: number) => {
        rotation.value = normalizeAngle(rotation.value + delta)
    }
    const rotateRight = () => rotateBy(90)
    const rotateLeft = () => rotateBy(-90)

    const zoomIn = () => (zoom.value = Math.min(zoom.value + 0.2, 4))
    const zoomOut = () => (zoom.value = Math.max(zoom.value - 0.2, 0.5))
    const handleWheel = (e: WheelEvent) => {
        e.preventDefault()
        if (e.deltaY < 0) zoomIn()
        else zoomOut()
    }

    const close = () => (visible.value = false)
    const goPrev = () => {
        if (index.value > 0) index.value--
    }
    const goNext = () => {
        if (index.value < props.images.length - 1) index.value++
    }

    const onImgLoad = (i: number) => {
        loading.value[i] = false
    }

    // 拖拽
    const startDrag = (e: MouseEvent) => {
        if (zoom.value === 1) return
        dragging.value = true
        dragStart.x = e.clientX - offset.x
        dragStart.y = e.clientY - offset.y
    }
    const onDrag = (e: MouseEvent) => {
        if (!dragging.value || zoom.value === 1) return
        offset.x = e.clientX - dragStart.x
        offset.y = e.clientY - dragStart.y
    }
    const endDrag = () => {
        dragging.value = false
    }
    const dragCursor = computed(() => {
        if (zoom.value > 1) return dragging.value ? 'grabbing' : 'grab'
        return 'default'
    })

    const onKeydown = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowLeft':
                goPrev()
                break
            case 'ArrowRight':
                goNext()
                break
            case '+':
            case '=':
                zoomIn()
                break
            case '-':
                zoomOut()
                break
            case '0':
                resetTransform()
                break
            case 'r':
                rotateRight()
                break
            case 'R':
                rotateLeft()
                break
            case 'Escape':
                close()
                break
            default:
                return
        }
        e.preventDefault()
    }

    watch(visible, val => {
        if (!import.meta.client) return
        if (val) {
            index.value = Math.min(
                Math.max(props.start, 0),
                Math.max(props.images.length - 1, 0)
            )
            resetTransform()
            loading.value = props.images.map(() => true)
            window.addEventListener('keydown', onKeydown)
        } else {
            window.removeEventListener('keydown', onKeydown)
        }
    })

    watch(index, () => resetTransform())

    onUnmounted(() => {
        if (import.meta.client) window.removeEventListener('keydown', onKeydown)
    })
</script>

<template>
    <v-dialog
        v-model="visible"
        fullscreen
        transition="dialog-bottom-transition"
        persistent
    >
        <v-card class="bg-black relative overflow-hidden">
            <v-toolbar dense flat color="black">
                <v-btn icon="mdi-close" color="white" @click="close" />
                <v-spacer></v-spacer>
                <div class="text-white text-sm pr-4">
                    {{ index + 1 }} / {{ images.length }}
                </div>
            </v-toolbar>

            <v-carousel
                v-model="index"
                hide-delimiters
                show-arrows
                height="80vh"
            >
                <v-carousel-item v-for="(img, i) in images" :key="i">
                    <div
                        class="relative w-full h-full flex items-center justify-center bg-black overflow-hidden"
                        :style="{ cursor: dragCursor }"
                        @wheel="handleWheel"
                        @mousedown="startDrag"
                        @mousemove="onDrag"
                        @mouseup="endDrag"
                        @mouseleave="endDrag"
                    >
                        <!-- 环境光背景：同图放大模糊，增强沉浸感 -->
                        <img
                            :src="img.src"
                            alt=""
                            aria-hidden="true"
                            class="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl"
                        />
                        <v-progress-circular
                            v-if="loading[i]"
                            indeterminate
                            color="white"
                            size="64"
                            class="absolute z-20"
                        />

                        <v-img
                            :src="img.src"
                            :alt="img.caption || ''"
                            class="select-none relative z-10 preview-img"
                            :style="{
                                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                                transition: dragging
                                    ? 'none'
                                    : 'transform 0.25s ease',
                                'max-height': '80vh',
                                'max-width': '90vw',
                                'object-fit': 'contain',
                                'user-select': 'none',
                            }"
                            @load="onImgLoad(i)"
                        />
                        <div
                            v-if="img.caption"
                            class="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-sm text-white/70"
                        >
                            {{ img.caption }}
                        </div>
                    </div>
                </v-carousel-item>
            </v-carousel>

            <!-- 预览控制栏 -->
            <div
                class="absolute bottom-5 left-1/2 z-30 flex w-[min(92vw,560px)] -translate-x-1/2 flex-col gap-1 rounded-2xl bg-white/10 px-4 py-2.5 text-white ring-1 ring-white/15 backdrop-blur-md"
            >
                <div class="flex items-center gap-3">
                    <v-icon size="18" color="white"> mdi-rotate-right </v-icon>
                    <v-slider
                        v-model="rotation"
                        :min="-180"
                        :max="180"
                        step="1"
                        density="compact"
                        hide-details
                        thumb-size="14"
                        class="flex-1"
                    />
                    <span class="w-12 text-right text-xs tabular-nums">
                        {{ rotation }}°
                    </span>
                </div>

                <div class="flex items-center justify-center gap-2">
                    <v-btn
                        icon
                        variant="text"
                        color="white"
                        data-cuelume-press
                        data-cuelume-release
                        @click="rotateLeft"
                    >
                        <v-icon icon="mdi-rotate-left" />
                        <v-tooltip activator="parent" location="top">
                            {{ t('rotate_left') }}
                        </v-tooltip>
                    </v-btn>
                    <v-btn
                        icon
                        variant="text"
                        color="white"
                        data-cuelume-press
                        data-cuelume-release
                        @click="zoomOut"
                    >
                        <v-icon icon="mdi-magnify-minus-outline" />
                        <v-tooltip activator="parent" location="top">
                            {{ t('zoom_out') }}
                        </v-tooltip>
                    </v-btn>
                    <v-btn
                        icon
                        variant="text"
                        color="white"
                        data-cuelume-press
                        data-cuelume-release
                        @click="resetZoom"
                    >
                        <v-icon icon="mdi-restore" />
                        <v-tooltip activator="parent" location="top">
                            {{ t('reset_view') }}
                        </v-tooltip>
                    </v-btn>
                    <v-btn
                        icon
                        variant="text"
                        color="white"
                        data-cuelume-press
                        data-cuelume-release
                        @click="zoomIn"
                    >
                        <v-icon icon="mdi-magnify-plus-outline" />
                        <v-tooltip activator="parent" location="top">
                            {{ t('zoom_in') }}
                        </v-tooltip>
                    </v-btn>
                    <v-btn
                        icon
                        variant="text"
                        color="white"
                        data-cuelume-press
                        data-cuelume-release
                        @click="rotateRight"
                    >
                        <v-icon icon="mdi-rotate-right" />
                        <v-tooltip activator="parent" location="top">
                            {{ t('rotate_right') }}
                        </v-tooltip>
                    </v-btn>
                </div>

                <div
                    class="text-center text-[11px] tracking-wide text-white/55"
                >
                    {{ t('preview_hint') }}
                </div>
            </div>
        </v-card>
    </v-dialog>
</template>

<style scoped>
    .select-none {
        user-select: none;
        pointer-events: auto;
    }

    .preview-img {
        filter: drop-shadow(0 12px 32px rgb(0 0 0 / 0.55));
    }
</style>
