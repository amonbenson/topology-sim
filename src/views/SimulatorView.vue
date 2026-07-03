<script setup lang="ts">
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import SelectButton from "primevue/selectbutton";

import ResistorCircuit from "@/components/ResistorCircuit.vue";
import { type ArmRole, useProjectStore } from "@/stores/project";

const store = useProjectStore();

const roleOptions: { label: string; value: ArmRole }[] = [
  { label: "Low", value: "low" },
  { label: "High", value: "high" },
  { label: "Floating", value: "floating" },
];

function runDetection(): void {
  // TODO: kick off the topology detection simulation
}
</script>

<template>
  <div class="flex h-auto w-full items-center justify-center">
    <ResistorCircuit :arms="store.arms" />
  </div>

  <div class="mx-auto flex max-w-md flex-col gap-6 p-6">
    <div
      class="flex flex-col gap-3 rounded-lg border border-surface-alt p-4"
    >
      <div class="flex flex-col gap-2">
        <label :for="`voltage-low`">Low Voltage (V)</label>
        <InputNumber
          :id="`voltage-low`"
          v-model="store.lowVoltage"
          mode="decimal"
          :min-fraction-digits="0"
          :max-fraction-digits="4"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label :for="`voltage-high`">High Voltage (V)</label>
        <InputNumber
          :id="`voltage-high`"
          v-model="store.highVoltage"
          mode="decimal"
          :min-fraction-digits="0"
          :max-fraction-digits="4"
        />
      </div>
    </div>

    <div
      v-for="arm in store.arms"
      :key="arm.index"
      class="flex flex-col gap-3 rounded-lg border border-surface-alt p-4"
    >
      <div class="flex items-center justify-between">
        <span class="font-medium">R{{ arm.index + 1 }}</span>
        <SelectButton
          v-model="arm.role"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label :for="`resistance-${arm.index}`">Resistance (Ω)</label>
        <div class="flex gap-2">
          <InputNumber
            :id="`resistance-${arm.index}`"
            v-model="arm.resistance"
            class="grow"
            mode="decimal"
            :min-fraction-digits="0"
            :max-fraction-digits="4"
          />
          <Button
            label="∞"
            severity="secondary"
            :outlined="arm.resistance !== Infinity"
            @click="arm.resistance = Infinity"
          />
        </div>
      </div>
    </div>

    <Button
      label="Run Detection"
      @click="runDetection"
    />
  </div>
</template>
