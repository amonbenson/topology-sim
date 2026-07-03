import { Emitter, type Event } from "@/utils/events";

import NetworkTopology from "./topology";

export class NetworkSolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkSolverError";
  }
}

// Encodes each arm's solved value the same way its resistance is naturally
// represented: 0 means shorted to the star point, Infinity means isolated
// (open), NaN means individually unresolvable (only observable as part of a
// pair's combined resistance), and any other finite number is that arm's
// fraction of totalResistance.
export interface NetworkSolution {
  readonly arms: readonly [number, number, number];
  readonly totalResistance: number;
}

interface PairMeasurement {
  readonly conducts: boolean;
  readonly pairResistance: number;
  readonly lowResistanceFraction: number;
}

export interface NetworkSolverOptions {
  readonly supplyVoltage?: number;
  readonly protectionResistance?: number;
  readonly openVoltageThreshold?: number;
  readonly shortResistanceThreshold?: number;
  readonly supplyConsistencyThreshold?: number;
  readonly consistencyRelativeThreshold?: number;
  readonly ratioDivisionEpsilon?: number;
  // How long to pause after each measurement step, so a caller can visually
  // step through the process. Defaults to 0 (no real delay), which keeps
  // solve() effectively synchronous for unit tests.
  readonly stepDelayMs?: number;
}

// Identifies the three arm resistances of a star-connected resistor network
// by driving each pair of terminals high/low (third floating) in turn and
// reading tap voltages only (never the network's own rail setpoints) — the
// same measurement protocol a real three-terminal detector circuit would use.
export default class NetworkSolver {
  private readonly network: NetworkTopology;
  private readonly supplyVoltage: number;
  private readonly protectionResistance: number;
  private readonly openVoltageThreshold: number;
  private readonly shortResistanceThreshold: number;
  private readonly supplyConsistencyThreshold: number;
  private readonly consistencyRelativeThreshold: number;
  private readonly ratioDivisionEpsilon: number;
  private readonly stepDelayMs: number;

  private status = "";
  private readonly statusChangeEmitter = new Emitter<string>();
  readonly onStatusChange: Event<string> = this.statusChangeEmitter.event;

  constructor(network: NetworkTopology, options: NetworkSolverOptions = {}) {
    if (network.armCount !== 3) {
      throw new NetworkSolverError(
        `NetworkSolver requires a three-arm network, got ${network.armCount} arms`,
      );
    }

    this.network = network;
    this.supplyVoltage = options.supplyVoltage ?? 3.3;
    this.protectionResistance = options.protectionResistance ?? 100;
    this.openVoltageThreshold = options.openVoltageThreshold ?? 1e-9;
    this.shortResistanceThreshold = options.shortResistanceThreshold ?? 1e-6;
    this.supplyConsistencyThreshold = options.supplyConsistencyThreshold ?? 1e-9;
    this.consistencyRelativeThreshold = options.consistencyRelativeThreshold ?? 1e-6;
    this.ratioDivisionEpsilon = options.ratioDivisionEpsilon ?? 1e-12;
    this.stepDelayMs = options.stepDelayMs ?? 0;
  }

  getStatus(): string {
    return this.status;
  }

  async solve(): Promise<NetworkSolution> {
    this.reportStatus("Starting detection…");

    this.network.setLowVoltage(0);
    this.network.setHighVoltage(this.supplyVoltage);
    this.network.setProtectionResistance(this.protectionResistance);

    const measurementAB = await this.measurePair(0, 1); // A high, B low: ratio = rB / (rA + rB)
    const measurementBC = await this.measurePair(1, 2); // B high, C low: ratio = rC / (rB + rC)

    let result: NetworkSolution;
    if (measurementAB.conducts && measurementBC.conducts) {
      result = this.resolveFromTwoPairs(measurementAB, measurementBC);
    } else if (measurementAB.conducts) {
      // rC is infinite: C is isolated.
      result = this.resolveFromSinglePair(measurementAB, [0, 0, Infinity], [NaN, NaN, Infinity]);
    } else if (measurementBC.conducts) {
      // rA is infinite: A is isolated.
      result = this.resolveFromSinglePair(measurementBC, [Infinity, 0, 0], [Infinity, NaN, NaN]);
    } else {
      // Neither pair conducted, so the isolated arm must be B — confirm with
      // the one measurement that hasn't been taken yet.
      const measurementCA = await this.measurePair(2, 0); // C high, A low: ratio = rA / (rC + rA)
      result = measurementCA.conducts
        // rB is infinite: B is isolated.
        ? this.resolveFromSinglePair(measurementCA, [0, Infinity, 0], [NaN, Infinity, NaN])
        : { arms: [Infinity, Infinity, Infinity], totalResistance: NaN };
    }

    this.reportStatus(this.describeResult(result));
    await this.delay();

    return result;
  }

  private resolveFromTwoPairs(measurementAB: PairMeasurement, measurementBC: PairMeasurement): NetworkSolution {
    const shortAB = measurementAB.pairResistance < this.shortResistanceThreshold;
    const shortBC = measurementBC.pairResistance < this.shortResistanceThreshold;

    if (shortAB && shortBC) {
      return { arms: [0, 0, 0], totalResistance: NaN };
    }

    if (shortAB) {
      return { arms: [0, 0, 1], totalResistance: measurementBC.pairResistance };
    }

    if (shortBC) {
      return { arms: [1, 0, 0], totalResistance: measurementAB.pairResistance };
    }

    const ratioAB = measurementAB.lowResistanceFraction; // rB / (rA + rB)
    const ratioBC = measurementBC.lowResistanceFraction; // rC / (rB + rC)

    const unnormalizedA = (1 - ratioAB) * (1 - ratioBC);
    const unnormalizedB = ratioAB * (1 - ratioBC);
    const unnormalizedC = ratioAB * ratioBC;
    const unnormalizedSum = unnormalizedA + unnormalizedB + unnormalizedC;

    const a = unnormalizedA / unnormalizedSum;
    const b = unnormalizedB / unnormalizedSum;
    const c = unnormalizedC / unnormalizedSum;

    // Two independent estimates of the total resistance must agree, since
    // they're both derived from the same underlying three-arm network.
    const scaleFromAB = measurementAB.pairResistance / (a + b);
    const scaleFromBC = measurementBC.pairResistance / (b + c);
    if (Math.abs(scaleFromAB - scaleFromBC) / (scaleFromAB + scaleFromBC) > this.consistencyRelativeThreshold) {
      throw new NetworkSolverError(
        `Total resistance estimates disagree: fromLowHigh=${scaleFromAB.toFixed(4)}, fromHighLow=${scaleFromBC.toFixed(4)}`,
      );
    }

    return { arms: [a, b, c], totalResistance: (scaleFromAB + scaleFromBC) / 2 };
  }

  private resolveFromSinglePair(
    measurement: PairMeasurement,
    shortedArms: readonly [number, number, number],
    unresolvedArms: readonly [number, number, number],
  ): NetworkSolution {
    if (measurement.pairResistance < this.shortResistanceThreshold) {
      return { arms: shortedArms, totalResistance: NaN };
    }

    return { arms: unresolvedArms, totalResistance: measurement.pairResistance };
  }

  private async measurePair(highIndex: number, lowIndex: number): Promise<PairMeasurement> {
    const floatingIndex = 3 - highIndex - lowIndex;

    this.reportStatus(
      `Driving Tap ${highIndex + 1} high, Tap ${lowIndex + 1} low, Tap ${floatingIndex + 1} floating…`,
    );

    this.network.setArmRole(highIndex, "high");
    this.network.setArmRole(lowIndex, "low");
    this.network.setArmRole(floatingIndex, "floating");

    await this.delay();

    const highVoltage = this.network.getArmVoltage(highIndex);
    const lowVoltage = this.network.getArmVoltage(lowIndex);
    const floatingVoltage = this.network.getArmVoltage(floatingIndex);

    // The same current flows through both protection resistors in a simple
    // two-arm loop, so their voltages must always sum back to the supply.
    if (Math.abs(highVoltage + lowVoltage - this.supplyVoltage) > this.supplyConsistencyThreshold) {
      throw new NetworkSolverError(
        `Supply voltage identity violated: high=${highVoltage.toFixed(6)}, low=${lowVoltage.toFixed(6)}`,
      );
    }

    const conducts = lowVoltage > this.openVoltageThreshold;
    if (!conducts) {
      return { conducts: false, pairResistance: NaN, lowResistanceFraction: NaN };
    }

    const voltageSpan = highVoltage - lowVoltage;
    const pairResistance = this.protectionResistance * voltageSpan / lowVoltage;
    const lowResistanceFraction = voltageSpan > this.ratioDivisionEpsilon
      ? (floatingVoltage - lowVoltage) / voltageSpan
      : NaN;

    return { conducts: true, pairResistance, lowResistanceFraction };
  }

  private describeResult(result: NetworkSolution): string {
    const armDescriptions = result.arms.map((value, index) => {
      const label = `Tap ${index + 1}`;

      if (Number.isNaN(value)) {
        return `${label}: unresolved`;
      }

      if (value === Infinity) {
        return `${label}: open`;
      }

      if (value === 0) {
        return `${label}: shorted`;
      }

      return `${label}: ${(value * result.totalResistance).toFixed(1)} Ω`;
    });

    return `Solved — ${armDescriptions.join(", ")}`;
  }

  private reportStatus(status: string): void {
    this.status = status;
    this.statusChangeEmitter.fire(status);
  }

  private async delay(): Promise<void> {
    if (this.stepDelayMs <= 0) {
      return;
    }

    await new Promise<void>(resolve => setTimeout(resolve, this.stepDelayMs));
  }
}
