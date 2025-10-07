<template>
    <v-layout>
        <v-navigation-drawer width="60" elevation="3"> </v-navigation-drawer>
        <AppBar />
        <v-navigation-drawer width="60" location="right" elevation="3">
        </v-navigation-drawer>
        <v-main class="bg-background">
            <slot />
        </v-main>
    </v-layout>
</template>
<script setup lang="ts"></script>
