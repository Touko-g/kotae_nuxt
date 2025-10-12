<template>
    <v-snackbar
        v-for="(msg, index) in messages"
        :key="msg.id"
        v-model="msg.visible"
        :timeout="msg.duration"
        :color="msg.color"
        :location="msg.position"
        transition="scroll-y-transition"
        class="transition-all"
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
    const { messages, close } = useSnakebar()

    const getOffsetStyle = (index: number, position = 'top') => {
        const gap = 12
        const base = 50
        const offset = base * index + gap * index
        if (position.includes('top')) return { marginTop: `${offset}px` }
        else return { marginBottom: `${offset}px` }
    }
</script>

<style scoped></style>
