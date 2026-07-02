<script setup lang="ts">
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import SelectButton from "primevue/selectbutton";

import { type TapRole, useProjectStore } from "@/stores/project";

const store = useProjectStore();

const roleOptions: { label: string; value: TapRole }[] = [
  { label: "Low", value: "low" },
  { label: "High", value: "high" },
  { label: "Output", value: "output" },
];

function runDetection(): void {
  // TODO: kick off the topology detection simulation
}
</script>

<template>
  <div class="flex h-full w-full items-center justify-center">
    <div class="topology-grid grid grid-cols-[var(--gl)_var(--gtw2)_var(--gl)_var(--gtw2)_var(--gl)_var(--gs)_var(--gl)_var(--gs)_var(--gl)_var(--gs)_var(--gl)] grid-rows-[var(--gl)_var(--gs)_var(--gl)_var(--gth)_var(--gl)_var(--gs)_var(--gl)_var(--gs)_var(--gl)] gap-0">
      <!-- resistor Y-topology -->
      <div class="relative col-span-3 col-start-2 row-start-4">
        <div
          v-for="(_, i) in 3"
          :key="i"
          class="absolute left-1/2 h-(--gta) w-(--gl) origin-bottom bg-current"
          :style="{ transform: `translateX(-50%) rotate(${i * 120}deg)` }"
        >
          A
        </div>
      </div>

      <!-- top tap -->
      <div class="circuit-wire col-span-7 col-start-4 row-start-3" />
      <div class="circuit-node col-start-3 row-start-3" />

      <!-- right tap -->
      <div class="circuit-wire col-span-5 col-start-6 row-start-5" />
      <div class="circuit-node col-start-5 row-start-5" />

      <!-- left tap -->
      <div class="circuit-wire col-start-0 row-span-2 row-start-6" />
      <div class="circuit-wire col-span-9 col-start-2 row-start-7" />
      <div class="circuit-node col-start-1 row-start-5" />
    </div>
  </div>

  <!-- <div class="mx-auto flex max-w-md flex-col gap-6 p-6">
    <div
      v-for="tap in store.taps"
      :key="tap.index"
      class="flex flex-col gap-3 rounded-lg border border-surface-alt p-4"
    >
      <div class="flex items-center justify-between">
        <span class="font-medium">Resistor {{ tap.index + 1 }}</span>
        <SelectButton
          v-model="tap.role"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label :for="`resistance-${tap.index}`">Resistance (Ω)</label>
        <InputNumber
          :id="`resistance-${tap.index}`"
          v-model="tap.resistance"
          mode="decimal"
          :min-fraction-digits="0"
          :max-fraction-digits="4"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label :for="`voltage-${tap.index}`">Voltage (V)</label>
        <InputNumber
          :id="`voltage-${tap.index}`"
          v-model="tap.voltage"
          mode="decimal"
          :min-fraction-digits="0"
          :max-fraction-digits="4"
          :readonly="tap.role === 'output'"
        />
      </div>
    </div>

    <Button
      label="Run Detection"
      @click="runDetection"
    />
  </div> -->
</template>

<style scoped>
.topology-grid {
  --gl: 0.125rem;
  --gs: 4rem;
  --gth: 15rem;
  --gtw: calc(var(--gth) / cos(30deg));
  --gtw2: calc(var(--gtw) / 2);
  --gta: calc(var(--gtw) / (2 * cos(30deg)));
}
</style>
