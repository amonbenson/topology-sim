<script setup lang="ts">
import { watchEffect } from "vue";

import { useMediaQuery } from "@/composables/useMediaQuery";

const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");

watchEffect(() => {
  document.documentElement.classList.toggle("dark", systemPrefersDark.value);
});
</script>

<template>
  <RouterView />
</template>
