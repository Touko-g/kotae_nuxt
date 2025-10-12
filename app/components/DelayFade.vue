<template>
    <TransitionGroup :css="false" @enter="onEnter">
        <slot />
    </TransitionGroup>
</template>

<script lang="ts" setup>
    import { animate } from 'animejs'

    const onEnter = (el: any, done: () => void) => {
        animate(el, {
            opacity: [0, 1],
            translateX: [100, 0],
            duration: 500,
            easing: 'easeInOutSine',
            delay: (el.dataset.index % 10) * 100,
            complete: done,
        })
    }
</script>

<style scoped></style>
