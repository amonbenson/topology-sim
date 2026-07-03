import { defineStore } from "pinia";

import { useProperty } from "@/composables/useProperty";
import ResistorNetwork from "@/core/network/resistorNetwork";

export type TapRole = "low" | "high" | "output";

// The shape a tap actually has once Pinia unwraps the underlying
// WritableComputedRefs — this is what templates and props see, not the
// store's own internal representation.
export interface ResistorTap {
  readonly index: number;
  readonly role: TapRole;
  readonly resistance: number;
  readonly voltage: number;
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

  const taps = resistorNetwork.resistors.map((resistor, index) => ({
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

  const lowTapIndex = useProperty(
    () => resistorNetwork.getLowTapIndex(),
    index => setTapRole(index, "low"),
    resistorNetwork.onConfigurationChange,
  );

  const highTapIndex = useProperty(
    () => resistorNetwork.getHighTapIndex(),
    index => setTapRole(index, "high"),
    resistorNetwork.onConfigurationChange,
  );

  const outputTapIndex = useProperty(
    () => resistorNetwork.getOutputTapIndex(),
    index => setTapRole(index, "output"),
    resistorNetwork.onConfigurationChange,
  );

  return {
    resistorNetwork,
    taps,
    lowTapIndex,
    highTapIndex,
    outputTapIndex,
  };
});
