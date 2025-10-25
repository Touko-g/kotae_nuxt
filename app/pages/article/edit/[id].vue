<script setup lang="ts">
    definePageMeta({
        middleware: 'auth',
    })
    const route = useRoute()
    const id = Array.isArray(route.params.id)
        ? route.params.id[0]
        : route.params.id
</script>

<template>
    <ArticleForm :id="id" mode="edit" />
</template>

<style scoped></style>
