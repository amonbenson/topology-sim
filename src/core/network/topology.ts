import { Emitter, type Event } from "@/utils/events";

import Resistor from "./resistor";

export class NetworkTopologyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkTopologyError";
  }
}

export type ArmRole = "low" | "high" | "floating";

// All resistances are in kΩ and all currents are in mA throughout this class
// (kΩ × mA = V, so voltage formulas need no unit conversion).
interface Arm {
  readonly resistor: Resistor;
  // Sits between the pullup/pulldown rail and the measurement resistor —
  // only carries current while this arm is actively driven high or low.
  pullResistance: number;
  // Sits right before the voltage measurement tap, between the pull
  // resistor and the arm's own resistance. Present for every arm, but only
  // matters electrically while driven, for the same reason as pullResistance.
  measurementResistance: number;
  role: ArmRole;
  voltage: number;
}

export default class NetworkTopology {
  private readonly arms: Arm[] = [
    { resistor: new Resistor(100), pullResistance: 1, measurementResistance: 1, role: "high", voltage: 0 },
    { resistor: new Resistor(200), pullResistance: 1, measurementResistance: 1, role: "floating", voltage: 0 },
    { resistor: new Resistor(300), pullResistance: 1, measurementResistance: 1, role: "low", voltage: 0 },
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

  getArmPullResistance(index: number): number {
    return this.getArm(index).pullResistance;
  }

  setArmPullResistance(index: number, value: number): void {
    this.getArm(index).pullResistance = value;
    this.recalculateVoltages();
  }

  getArmMeasurementResistance(index: number): number {
    return this.getArm(index).measurementResistance;
  }

  setArmMeasurementResistance(index: number, value: number): void {
    this.getArm(index).measurementResistance = value;
    this.recalculateVoltages();
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

      // The pull and measurement resistors sit in series with the arm on the
      // path to the star point, so together they lower that path's
      // conductance the same way the arm's own resistance does.
      const seriesResistance = arm.pullResistance + arm.measurementResistance + arm.resistor.getResistance();
      const conductance = 1 / seriesResistance;
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
      const protectionResistance = arm.pullResistance + arm.measurementResistance;

      // The current flowing from this arm's rail to the star point causes a
      // voltage drop across the pull and measurement resistors, so the tap
      // itself reads slightly off the rail voltage. An infinite arm
      // resistance carries no current no matter what the star-point voltage
      // is (even if it's NaN, e.g. every driven arm is infinite).
      const current = Number.isFinite(armResistance) ? (railVoltage - starPointVoltage) / (protectionResistance + armResistance) : 0;
      arm.voltage = railVoltage - current * protectionResistance;
    }

    this.voltageChangeEmitter.fire();
  }
}
