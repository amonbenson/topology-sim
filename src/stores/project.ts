import { defineStore } from "pinia";
import type { WritableComputedRef } from "vue";

import { useProperty } from "@/composables/useProperty";
import ResistorNetwork from "@/core/network/resistorNetwork";

export type TapRole = "low" | "high" | "output";

export interface ResistorTap {
  readonly index: number;
  readonly role: WritableComputedRef<TapRole>;
  readonly resistance: WritableComputedRef<number>;
  readonly voltage: WritableComputedRef<number>;
}

export const useProjectStore = defineStore("project", () => {
  const resistorNetwork = new ResistorNetwork();

  function tapRole(tapIndex: number): TapRole {
    if (tapIndex === resistorNetwork.getLowTapIndex()) {
      return "low";
    }

    if (tapIndex === resistorNetwork.getHighTapIndex()) {
      return "high";
    }

    return "output";
  }

  function setTapRole(tapIndex: number, role: TapRole): void {
    const previousRole = tapRole(tapIndex);
    if (previousRole === role) {
      return;
    }

    // Each role must be held by exactly one tap, so give the tap that currently
    // holds the requested role this tap's previous role in exchange.
    const tapIndicesByRole: Record<TapRole, number> = {
      low: resistorNetwork.getLowTapIndex(),
      high: resistorNetwork.getHighTapIndex(),
      output: resistorNetwork.getOutputTapIndex(),
    };

    const previousHolderOfRole = tapIndicesByRole[role];
    tapIndicesByRole[role] = tapIndex;
    tapIndicesByRole[previousRole] = previousHolderOfRole;

    resistorNetwork.setTapConfiguration(tapIndicesByRole.low, tapIndicesByRole.high);
  }

  function setVoltageOfTap(tapIndex: number, value: number): void {
    const role = tapRole(tapIndex);
    if (role === "low") {
      resistorNetwork.setLowVoltage(value);
    } else if (role === "high") {
      resistorNetwork.setHighVoltage(value);
    }
  }

  const taps: ResistorTap[] = resistorNetwork.resistors.map((resistor, index) => ({
    index,
    role: useProperty(
      () => tapRole(index),
      role => setTapRole(index, role),
      resistorNetwork.onConfigurationChange,
    ),
    resistance: useProperty(
      () => resistor.getResistance(),
      value => resistor.setResistance(value),
      resistor.onResistanceChange,
    ),
    voltage: useProperty(
      () => resistorNetwork.getVoltageAt(index),
      value => setVoltageOfTap(index, value),
      resistorNetwork.onConfigurationChange,
    ),
  }));

  return {
    resistorNetwork,
    taps,
  };
});
