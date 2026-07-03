import { Emitter, type Event } from "@/utils/events";

import Resistor from "./resistor";

export class NetworkTopologyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkTopologyError";
  }
}

export type ArmRole = "low" | "high" | "floating";

interface Arm {
  readonly resistor: Resistor;
  role: ArmRole;
  voltage: number;
}

export default class NetworkTopology {
  private readonly arms: Arm[] = [
    { resistor: new Resistor(100), role: "high", voltage: 0 },
    { resistor: new Resistor(200), role: "floating", voltage: 0 },
    { resistor: new Resistor(300), role: "low", voltage: 0 },
  ];

  private lowVoltage = 0;
  private highVoltage = 3.3;

  // A resistor in series between each driven rail and its arm.
  private protectionResistance = 0;

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

  getProtectionResistance(): number {
    return this.protectionResistance;
  }

  setProtectionResistance(value: number): void {
    this.protectionResistance = value;
    this.recalculateVoltages();
  }

  private getArm(index: number): Arm {
    const arm = this.arms[index];
    if (!arm) {
      throw new NetworkTopologyError(`No arm exists at index: ${index}`);
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

      // The protection resistor sits in series with the arm on the path to
      // the star point, so it lowers that path's conductance the same way.
      const conductance = 1 / (this.protectionResistance + arm.resistor.getResistance());
      const drivenVoltage = arm.role === "high" ? this.highVoltage : this.lowVoltage;

      conductanceSum += conductance;
      weightedVoltageSum += drivenVoltage * conductance;
    }

    // Floating arms carry no current, so their tap settles at the star-point
    // voltage formed by the voltage divider of whichever arms are actively driven.
    // If no arm is driving the (e.g. all arms are floating), that voltage is undefined.
    const starPointVoltage = conductanceSum === 0 ? NaN : weightedVoltageSum / conductanceSum;

    for (const arm of this.arms) {
      if (arm.role === "floating") {
        // A floating arm only settles at the star-point voltage if it has a
        // conductive path to it; an infinite-resistance arm is fully isolated.
        arm.voltage = Number.isFinite(arm.resistor.getResistance()) ? starPointVoltage : NaN;
        continue;
      }

      const railVoltage = arm.role === "high" ? this.highVoltage : this.lowVoltage;
      const armResistance = arm.resistor.getResistance();

      // The current flowing from this arm's rail to the star point causes a
      // voltage drop across the protection resistor, so the tap itself reads
      // slightly off the rail voltage. With no protection resistor (the
      // default), this reduces to exactly the rail voltage. An infinite
      // arm resistance carries no current no matter what the star-point
      // voltage is (even if it's NaN, e.g. every driven arm is infinite).
      const current = Number.isFinite(armResistance) ? (railVoltage - starPointVoltage) / (this.protectionResistance + armResistance) : 0;
      arm.voltage = railVoltage - current * this.protectionResistance;
    }

    this.voltageChangeEmitter.fire();
  }
}
