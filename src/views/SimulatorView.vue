<script setup lang="ts">
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import { ref } from "vue";

const rA = ref<number | null>(null);
const rB = ref<number | null>(null);
const rC = ref<number | null>(null);

function runDetection(): void {
  // TODO: kick off the topology detection simulation
}
</script>

<template>
  <div class="mx-auto flex max-w-sm flex-col gap-4 p-6">
    <div class="flex flex-col gap-2">
      <label for="r-a">R_A</label>
      <InputNumber
        id="r-a"
        v-model="rA"
        mode="decimal"
        :min-fraction-digits="0"
        :max-fraction-digits="4"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label for="r-b">R_B</label>
      <InputNumber
        id="r-b"
        v-model="rB"
        mode="decimal"
        :min-fraction-digits="0"
        :max-fraction-digits="4"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label for="r-c">R_C</label>
      <InputNumber
        id="r-c"
        v-model="rC"
        mode="decimal"
        :min-fraction-digits="0"
        :max-fraction-digits="4"
      />
    </div>

    <Button
      label="Run Detection"
      @click="runDetection"
    />
  </div>
</template>
