import { defineStore } from "pinia";

import { useProperty } from "@/composables/useProperty";
import ResistorNetwork, { type ArmRole } from "@/core/network/resistorNetwork";

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
  const resistorNetwork = new ResistorNetwork();

  const arms = Array.from({ length: resistorNetwork.armCount }, (_, index) => ({
    index,
    role: useProperty(
      () => resistorNetwork.getArmRole(index),
      (role: ArmRole) => resistorNetwork.setArmRole(index, role),
      resistorNetwork.onVoltageChange,
    ),
    resistance: useProperty(
      () => resistorNetwork.getArmResistance(index),
      (value: number) => resistorNetwork.setArmResistance(index, value),
      resistorNetwork.onVoltageChange,
    ),
    voltage: useProperty(
      () => resistorNetwork.getArmVoltage(index),
      (_) => {},
      resistorNetwork.onVoltageChange,
    ),
  }));

  const lowVoltage = useProperty(
    () => resistorNetwork.getLowVoltage(),
    (value: number) => resistorNetwork.setLowVoltage(value),
    resistorNetwork.onVoltageChange,
  );

  const highVoltage = useProperty(
    () => resistorNetwork.getHighVoltage(),
    (value: number) => resistorNetwork.setHighVoltage(value),
    resistorNetwork.onVoltageChange,
  );

  return {
    resistorNetwork,
    arms,
    lowVoltage,
    highVoltage,
  };
});
