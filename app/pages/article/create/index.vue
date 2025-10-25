<script setup lang="ts">
    definePageMeta({
        middleware: 'auth',
    })
</script>

<template>
    <ArticleForm mode="create" />
</template>

<style scoped></style>
