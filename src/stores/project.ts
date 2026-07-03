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
  readonly pullResistance: number;
  readonly measurementResistance: number;
  readonly voltage: number;
}

export const useProjectStore = defineStore("project", () => {
  const topology = new NetworkTopology();
  const solver = new NetworkSolver(topology, { stepDelayMs: 1000 });

  const arms = Array.from({ length: topology.armCount }, (_, index) => ({
    index,
    role: useProperty(
      () => topology.getArmRole(index),
      (role: ArmRole) => topology.setArmRole(index, role),
      topology.onVoltageChange,
    ),
    resistance: useProperty(
      () => topology.getArmResistance(index),
      (value: number) => topology.setArmResistance(index, value),
      topology.onVoltageChange,
    ),
    pullResistance: useProperty(
      () => topology.getArmPullResistance(index),
      (value: number) => topology.setArmPullResistance(index, value),
      topology.onVoltageChange,
    ),
    measurementResistance: useProperty(
      () => topology.getArmMeasurementResistance(index),
      (value: number) => topology.setArmMeasurementResistance(index, value),
      topology.onVoltageChange,
    ),
    voltage: useProperty(
      () => topology.getArmVoltage(index),
      (_) => {},
      topology.onVoltageChange,
    ),
  }));

  const lowVoltage = useProperty(
    () => topology.getLowVoltage(),
    (value: number) => topology.setLowVoltage(value),
    topology.onVoltageChange,
  );

  const highVoltage = useProperty(
    () => topology.getHighVoltage(),
    (value: number) => topology.setHighVoltage(value),
    topology.onVoltageChange,
  );

  const solverStatus = useEvent(solver.onStatusChange, () => solver.getStatus());
  const isSolving = ref(false);

  async function runDetection(): Promise<void> {
    if (isSolving.value) {
      return;
    }

    isSolving.value = true;
    try {
      await solver.solve();
    } finally {
      isSolving.value = false;
    }
  }

  return {
    topology,
    arms,
    lowVoltage,
    highVoltage,
    solverStatus,
    isSolving,
    runDetection,
  };
});
