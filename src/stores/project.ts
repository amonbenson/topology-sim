import { defineStore } from "pinia";
import { ref } from "vue";

import { useEvent } from "@/composables/useEvent";
import { useProperty } from "@/composables/useProperty";
import NetworkSolver from "@/core/network/solver";
import NetworkTopology, { type ArmRole } from "@/core/network/topology";

export type { ArmRole };

// The shape an arm actually has once Pinia unwraps the underlying
// WritableComputedRefs — this is what templates and props see, not the
// store's own internal representation.
export interface ResistorArm {
  readonly index: number;
  readonly role: ArmRole;
  readonly resistance: number;
  readonly voltage: number;
}

export const useProjectStore = defineStore("project", () => {
  const networkTopology = new NetworkTopology();
  const networkSolver = new NetworkSolver(networkTopology, { stepDelayMs: 600 });

  const arms = Array.from({ length: networkTopology.armCount }, (_, index) => ({
    index,
    role: useProperty(
      () => networkTopology.getArmRole(index),
      (role: ArmRole) => networkTopology.setArmRole(index, role),
      networkTopology.onVoltageChange,
    ),
    resistance: useProperty(
      () => networkTopology.getArmResistance(index),
      (value: number) => networkTopology.setArmResistance(index, value),
      networkTopology.onVoltageChange,
    ),
    voltage: useProperty(
      () => networkTopology.getArmVoltage(index),
      (_) => {},
      networkTopology.onVoltageChange,
    ),
  }));

  const lowVoltage = useProperty(
    () => networkTopology.getLowVoltage(),
    (value: number) => networkTopology.setLowVoltage(value),
    networkTopology.onVoltageChange,
  );

  const highVoltage = useProperty(
    () => networkTopology.getHighVoltage(),
    (value: number) => networkTopology.setHighVoltage(value),
    networkTopology.onVoltageChange,
  );

  const solverStatus = useEvent(networkSolver.onStatusChange, () => networkSolver.getStatus());
  const isSolving = ref(false);

  async function runDetection(): Promise<void> {
    if (isSolving.value) {
      return;
    }

    isSolving.value = true;
    try {
      await networkSolver.solve();
    } finally {
      isSolving.value = false;
    }
  }

  return {
    networkTopology,
    arms,
    lowVoltage,
    highVoltage,
    solverStatus,
    isSolving,
    runDetection,
  };
});
