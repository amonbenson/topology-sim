<script setup lang="ts">
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import SelectButton from "primevue/selectbutton";

import ResistorCircuit from "@/components/ResistorCircuit.vue";
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
  <div class="flex h-auto w-full items-center justify-center">
    <ResistorCircuit :taps="store.taps" />
  </div>

  <div class="mx-auto flex max-w-md flex-col gap-6 p-6">
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
  </div>
</template>
