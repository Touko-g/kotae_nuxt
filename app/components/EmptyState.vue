<script setup lang="ts">
    withDefaults(
        defineProps<{
            icon?: string
            title: string
            subtitle?: string
        }>(),
        {
            icon: 'mdi-inbox-outline',
            subtitle: '',
        }
    )
</script>

<template>
    <div
        class="anim anim-fade d-flex flex-column align-center justify-center text-center py-12 px-4"
    >
        <v-icon :icon="icon" size="64" color="grey-lighten-1" class="mb-4" />
        <div class="text-grey">{{ title }}</div>
        <div v-if="subtitle" class="text-caption text-grey mt-1">
            {{ subtitle }}
        </div>
        <slot />
    </div>
</template>

<style scoped></style>
