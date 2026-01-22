<template>
    <v-snackbar
        v-for="(msg, index) in messages"
        :key="msg.id"
        v-model="msg.visible"
        :timeout="msg.duration"
        :color="msg.color"
        :location="msg.position"
        transition="scroll-y-transition"
        :style="getOffsetStyle(index, msg.position)"
    >
        {{ msg.text }}
        <template #actions>
            <v-btn
                v-if="msg.close"
                variant="text"
                size="small"
                icon="mdi-close"
                @click="close(msg.id)"
            />
        </template>
    </v-snackbar>
</template>

<script setup lang="ts">
    const { messages, close } = useSnackbar()

    const getOffsetStyle = (index: number, position = 'top') => {
        const gap = 12
        const base = 50
        const offset = (base + gap) * index

        if (position.includes('top'))
            return { transform: `translateY(${offset}px)` }
        else return { transform: `translateY(-${offset}px)` }
    }
</script>

<style scoped>
    /* Snackbar 平滑过渡 */
    .v-snackbar {
        transition:
            transform 0.3s ease,
            opacity 0.3s ease;

        will-change: transform, opacity;
    }
</style>
