<script setup lang="ts">
    interface MenuItem {
        key: string
        text: string
        icon: string
    }

    interface Props {
        items: MenuItem[]
        /** 传了文字就是带文案的按钮，否则是纯图标按钮 */
        label?: string
        location?: 'bottom end' | 'bottom start' | 'top end' | 'top start'
    }

    const props = defineProps<Props>()
    const emit = defineEmits<{ select: [key: string] }>()

    const placement = computed(() => props.location ?? 'bottom end')
</script>

<template>
    <v-menu :location="placement">
        <template #activator="{ props: menuProps }">
            <!--
                :icon="!label" 是这一行最重要的东西。
                Vuetify 里「是不是图标按钮」决定了两个盒模型：
                  .v-btn            → 高 28px（size=small），图标被缩到 24×0.857≈20.6px
                  .v-btn--icon      → 40×40（size=small），图标满 24px
                之前只把 <v-icon> 塞进普通按钮，于是这个按钮比旁边的表情、麦克风
                矮 12px，在 #append-inner 的 align-items: flex-start 下整体高出一截。
                加上 icon 之后三个按钮的盒子完全一致，也就自然对齐了。
            -->
            <v-btn
                v-bind="menuProps"
                :icon="!label"
                size="small"
                color="primary"
                :variant="label ? 'tonal' : 'text'"
                :aria-label="label ?? 'AI'"
                data-cuelume-press
                data-cuelume-release
            >
                <!-- 图标必须放在插槽里：icon 属性传 undefined 时 Vuetify 不会渲染任何内容，
                     会变成一个点得到但看不见的空按钮 -->
                <v-icon :start="!!label" icon="mdi-auto-fix" />
                <span v-if="label">{{ label }}</span>
            </v-btn>
        </template>
        <v-list density="compact" min-width="180">
            <v-list-item
                v-for="item in items"
                :key="item.key"
                :prepend-icon="item.icon"
                :title="item.text"
                @click="emit('select', item.key)"
            />
        </v-list>
    </v-menu>
</template>
