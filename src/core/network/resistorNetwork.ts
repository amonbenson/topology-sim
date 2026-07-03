import { Emitter, type Event } from "@/utils/events";

import Resistor from "./resistor";

export class ResistorNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResistorNetworkError";
  }
}

export type ArmRole = "low" | "high" | "floating";

interface Arm {
  readonly resistor: Resistor;
  role: ArmRole;
  voltage: number;
}

export default class ResistorNetwork {
  private readonly arms: Arm[] = [
    { resistor: new Resistor(100), role: "high", voltage: 0 },
    { resistor: new Resistor(200), role: "floating", voltage: 0 },
    { resistor: new Resistor(300), role: "low", voltage: 0 },
  ];

  private lowVoltage = 0;
  private highVoltage = 3.3;

  private readonly voltageChangeEmitter = new Emitter<void>();
  readonly onVoltageChange: Event<void> = this.voltageChangeEmitter.event;

  constructor() {
    for (const arm of this.arms) {
      arm.resistor.onResistanceChange(() => {
        this.recalculateVoltages();
      });
    }

    this.recalculateVoltages();
  }

  get armCount(): number {
    return this.arms.length;
  }

  getArmRole(index: number): ArmRole {
    return this.getArm(index).role;
  }

  setArmRole(index: number, role: ArmRole): void {
    this.getArm(index).role = role;
    this.recalculateVoltages();
  }

  getArmVoltage(index: number): number {
    return this.getArm(index).voltage;
  }

  getArmResistance(index: number): number {
    return this.getArm(index).resistor.getResistance();
  }

  setArmResistance(index: number, value: number): void {
    this.getArm(index).resistor.setResistance(value);
  }

  getLowVoltage(): number {
    return this.lowVoltage;
  }

  setLowVoltage(value: number): void {
    this.lowVoltage = value;
    this.recalculateVoltages();
  }

  getHighVoltage(): number {
    return this.highVoltage;
  }

  setHighVoltage(value: number): void {
    this.highVoltage = value;
    this.recalculateVoltages();
  }

  private getArm(index: number): Arm {
    const arm = this.arms[index];
    if (!arm) {
      throw new ResistorNetworkError(`No arm exists at index: ${index}`);
    }

    return arm;
  }

  private recalculateVoltages(): void {
    let conductanceSum = 0;
    let weightedVoltageSum = 0;

    for (const arm of this.arms) {
      if (arm.role === "floating") {
        continue;
      }

      const conductance = 1 / arm.resistor.getResistance();
      const drivenVoltage = arm.role === "high" ? this.highVoltage : this.lowVoltage;

      conductanceSum += conductance;
      weightedVoltageSum += drivenVoltage * conductance;
    }

    // Floating arms carry no current, so their tap settles at the star-point
    // voltage formed by the voltage divider of whichever arms are actively driven.
    // If no arm is driving the network (e.g. all arms are floating), that
    // voltage is undefined.
    const starPointVoltage = conductanceSum === 0 ? NaN : weightedVoltageSum / conductanceSum;

    for (const arm of this.arms) {
      if (arm.role === "low") {
        arm.voltage = this.lowVoltage;
      } else if (arm.role === "high") {
        arm.voltage = this.highVoltage;
      } else {
        // A floating arm only settles at the star-point voltage if it has a
        // conductive path to it; an infinite-resistance arm is fully isolated.
        arm.voltage = Number.isFinite(arm.resistor.getResistance()) ? starPointVoltage : NaN;
      }
    }

    this.voltageChangeEmitter.fire();
  }
}
