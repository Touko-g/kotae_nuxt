<template>
    <TransitionGroup
        tag="div"
        name="delay-fade"
        appear
        class="delay-fade-group"
    >
        <slot />
    </TransitionGroup>
</template>

<script lang="ts" setup></script>

<style scoped></style>
