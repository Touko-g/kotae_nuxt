<script setup lang="ts">
    const loading = useState('loading', () => false)
</script>

<template>
    <v-overlay
        v-model="loading"
        persistent
        opacity="0.1"
        class="align-center justify-center"
    >
        <v-progress-circular indeterminate color="info" size="64" />
    </v-overlay>
</template>

<style scoped></style>
