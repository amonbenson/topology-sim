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
</script>

<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden md:flex-row">
    <div class="flex w-full items-center justify-center">
      <ResistorCircuit :arms="store.arms" />
    </div>

    <div class="mx-auto h-auto w-md max-w-md flex-none overflow-y-auto">
      <div class="flex w-full flex-col gap-6 p-6">
        <Button
          label="Run Detection"
          :disabled="store.isSolving"
          @click="store.runDetection"
        />
        <p
          v-if="store.isSolving || store.solverStatus"
          class="text-center text-sm text-muted"
        >
          {{ store.solverStatus }}
        </p>

        <!-- Taps (Roles and Resistances) -->
        <div
          v-for="arm, i in store.arms"
          :key="arm.index"
          class="flex flex-col gap-3 rounded-lg border-4 bg-surface-alt p-4"
          :class="['border-primary-500', 'border-cyan-500', 'border-pink-500'][i]"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium">Tap {{ arm.index + 1 }}</span>
            <SelectButton
              v-model="arm.role"
              :options="roleOptions"
              option-label="label"
              option-value="value"
              :allow-empty="false"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label :for="`resistance-${arm.index}`">Resistance (k&#x3A9;)</label>
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

          <div class="flex flex-col gap-2">
            <label :for="`pull-resistance-${arm.index}`">Pull Resistance (k&#x3A9;)</label>
            <InputNumber
              :id="`pull-resistance-${arm.index}`"
              v-model="arm.pullResistance"
              mode="decimal"
              :min-fraction-digits="0"
              :max-fraction-digits="4"
            />
          </div>
        </div>

        <!-- Supply Voltage -->
        <div
          class="flex flex-col gap-3 rounded-lg bg-surface-alt p-4"
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
      </div>
    </div>
  </div>
</template>
