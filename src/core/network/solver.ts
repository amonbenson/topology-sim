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
  readonly openCurrentThreshold?: number;
  readonly shortResistanceThreshold?: number;
  readonly currentConsistencyThreshold?: number;
  readonly resistanceConsistencyThreshold?: number;
  readonly resistanceSumEpsilon?: number;
  readonly ratioDivisionEpsilon?: number;
  // How long to pause after each measurement step, so a caller can visually
  // step through the process. Defaults to 0 (no real delay), which keeps
  // solve() effectively synchronous for unit tests.
  readonly stepDelayMs?: number;
}

// Identifies the three arm resistances of a star-connected resistor topology
// by driving pairs of terminals high/low (third floating) and reading tap
// voltages only — never the topology's own rail setpoints.
//
// The first arm stays driven high for every measurement, and only the other
// two take turns being driven low. This halves the number of role changes
// compared to rotating through every pair, which matters on real hardware
// where reconfiguring a pin is comparatively slow. Because both measurements
// share the first arm, it ends up with two independent resistance estimates
// that must agree with each other; the other two arms each get only one. A
// third measurement, between the second and third arms, is only needed to
// tell apart "the first arm is isolated" from "the network is fully
// disconnected", since neither of the first two measurements would conduct
// in either case.
//
// All resistances are in kΩ and all currents are in mA throughout this class
// (kΩ × mA = V, so voltage formulas need no unit conversion). Every arm's
// pull resistance is assumed identical by design — it's a known apparatus
// constant, not a property of the unknown network being measured, so reading
// it directly (from whichever arm happens to be driven high) is fair game.
export default class NetworkSolver {
  private readonly topology: NetworkTopology;
  // Neither rail voltage is known in advance — both are fixed properties of
  // the topology, measured directly rather than assumed or configured.
  private highRailVoltage = NaN;
  private lowRailVoltage = NaN;
  private readonly openCurrentThreshold: number;
  private readonly shortResistanceThreshold: number;
  private readonly currentConsistencyThreshold: number;
  private readonly resistanceConsistencyThreshold: number;
  private readonly resistanceSumEpsilon: number;
  private readonly ratioDivisionEpsilon: number;
  private readonly stepDelayMs: number;

  private status = "";
  private readonly statusChangeEmitter = new Emitter<string>();
  readonly onStatusChange: Event<string> = this.statusChangeEmitter.event;

  constructor(topology: NetworkTopology, options: NetworkSolverOptions = {}) {
    if (topology.armCount !== 3) {
      throw new NetworkSolverError(
        `NetworkSolver requires a three-arm topology, got ${topology.armCount} arms`,
      );
    }

    this.topology = topology;
    this.openCurrentThreshold = options.openCurrentThreshold ?? 1e-9;
    this.shortResistanceThreshold = options.shortResistanceThreshold ?? 1e-6;
    this.currentConsistencyThreshold = options.currentConsistencyThreshold ?? 1e-9;
    this.resistanceConsistencyThreshold = options.resistanceConsistencyThreshold ?? 1e-6;
    this.resistanceSumEpsilon = options.resistanceSumEpsilon ?? 1e-9;
    this.ratioDivisionEpsilon = options.ratioDivisionEpsilon ?? 1e-12;
    this.stepDelayMs = options.stepDelayMs ?? 0;
  }

  getStatus(): string {
    return this.status;
  }

  getHighRailVoltage(): number {
    return this.highRailVoltage;
  }

  getLowRailVoltage(): number {
    return this.lowRailVoltage;
  }

  async solve(): Promise<NetworkSolution> {
    this.reportStatus("Starting detection…");

    await this.measureRailVoltages();

    const firstMeasurement = await this.measurePair(0, 1); // arm 0 high, arm 1 low, arm 2 floating
    const secondMeasurement = await this.measurePair(0, 2); // arm 0 high, arm 2 low, arm 1 floating

    let result: NetworkSolution;
    if (firstMeasurement.conducts && secondMeasurement.conducts) {
      result = this.resolveFromBothMeasurements(firstMeasurement, secondMeasurement);
    } else if (firstMeasurement.conducts) {
      // Arm 2 is infinite: it's isolated.
      result = this.resolveFromSinglePair(firstMeasurement, [0, 0, Infinity], [NaN, NaN, Infinity]);
    } else if (secondMeasurement.conducts) {
      // Arm 1 is infinite: it's isolated.
      result = this.resolveFromSinglePair(secondMeasurement, [0, Infinity, 0], [NaN, Infinity, NaN]);
    } else {
      // Neither measurement conducted, so arm 0 must be isolated — confirm
      // with the one measurement that hasn't been taken yet.
      const thirdMeasurement = await this.measurePair(1, 2);
      result = thirdMeasurement.conducts
        // Arm 0 is infinite: it's isolated.
        ? this.resolveFromSinglePair(thirdMeasurement, [Infinity, 0, 0], [Infinity, NaN, NaN])
        : { arms: [Infinity, Infinity, Infinity], totalResistance: NaN };
    }

    this.reportStatus(this.describeResult(result));
    await this.delay();

    return result;
  }

  private resolveFromBothMeasurements(firstMeasurement: PairMeasurement, secondMeasurement: PairMeasurement): NetworkSolution {
    const firstPairIsShorted = firstMeasurement.pairResistance < this.shortResistanceThreshold;
    const secondPairIsShorted = secondMeasurement.pairResistance < this.shortResistanceThreshold;

    if (firstPairIsShorted && secondPairIsShorted) {
      return { arms: [0, 0, 0], totalResistance: NaN };
    }

    if (firstPairIsShorted) {
      // Arms 0 and 1 are shorted, so arm 2 holds the entire remaining resistance.
      return { arms: [0, 0, 1], totalResistance: secondMeasurement.pairResistance };
    }

    if (secondPairIsShorted) {
      // Arms 0 and 2 are shorted, so arm 1 holds the entire remaining resistance.
      return { arms: [0, 1, 0], totalResistance: firstMeasurement.pairResistance };
    }

    const secondArmResistance = firstMeasurement.lowResistanceFraction * firstMeasurement.pairResistance;
    const thirdArmResistance = secondMeasurement.lowResistanceFraction * secondMeasurement.pairResistance;
    const sharedArmResistanceFromFirstMeasurement = (1 - firstMeasurement.lowResistanceFraction) * firstMeasurement.pairResistance;
    const sharedArmResistanceFromSecondMeasurement = (1 - secondMeasurement.lowResistanceFraction) * secondMeasurement.pairResistance;

    // Both measurements drove arm 0, so they each produce an independent
    // estimate of its resistance — these must agree, since they're derived
    // from the same underlying three-arm topology. The small epsilon guards
    // against dividing by zero when the shared arm is itself a short (a case
    // the shorted-pair checks above can miss, since a pair sum stays large
    // as long as the *other* arm in it isn't also small).
    const sharedArmResistanceSum = sharedArmResistanceFromFirstMeasurement + sharedArmResistanceFromSecondMeasurement;
    const sharedArmDisagreement = Math.abs(sharedArmResistanceFromFirstMeasurement - sharedArmResistanceFromSecondMeasurement);
    if (sharedArmDisagreement / (sharedArmResistanceSum + this.resistanceSumEpsilon) > this.resistanceConsistencyThreshold) {
      throw new NetworkSolverError(
        `Shared arm resistance estimates disagree: fromFirstMeasurement=${sharedArmResistanceFromFirstMeasurement.toFixed(4)}, fromSecondMeasurement=${sharedArmResistanceFromSecondMeasurement.toFixed(4)}`,
      );
    }

    const sharedArmResistance = sharedArmResistanceSum / 2;
    const totalResistance = sharedArmResistance + secondArmResistance + thirdArmResistance;

    return {
      arms: [sharedArmResistance / totalResistance, secondArmResistance / totalResistance, thirdArmResistance / totalResistance],
      totalResistance,
    };
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

  // Drives a single arm at a time, with the other two left floating, so it
  // carries no current no matter what any arm's resistance is — that tap
  // therefore reads exactly its rail voltage, with no ambiguity, which is
  // the only way to learn each rail's true value from voltage alone.
  private async measureRailVoltages(): Promise<void> {
    this.reportStatus("Measuring high rail voltage…");
    this.topology.setArmRole(0, "high");
    this.topology.setArmRole(1, "floating");
    this.topology.setArmRole(2, "floating");
    await this.delay();
    this.highRailVoltage = this.topology.getArmVoltage(0);

    this.reportStatus("Measuring low rail voltage…");
    this.topology.setArmRole(0, "low");
    await this.delay();
    this.lowRailVoltage = this.topology.getArmVoltage(0);

    this.reportStatus(
      `Measured supply rails: low=${this.lowRailVoltage.toFixed(3)} V, high=${this.highRailVoltage.toFixed(3)} V`,
    );
  }

  private async measurePair(highIndex: number, lowIndex: number): Promise<PairMeasurement> {
    const floatingIndex = 3 - highIndex - lowIndex;

    this.reportStatus(
      `Driving Tap ${highIndex + 1} high, Tap ${lowIndex + 1} low, Tap ${floatingIndex + 1} floating…`,
    );

    this.topology.setArmRole(highIndex, "high");
    this.topology.setArmRole(lowIndex, "low");
    this.topology.setArmRole(floatingIndex, "floating");

    await this.delay();

    const highVoltage = this.topology.getArmVoltage(highIndex);
    const lowVoltage = this.topology.getArmVoltage(lowIndex);
    const floatingVoltage = this.topology.getArmVoltage(floatingIndex);

    // Every arm shares the same pull resistance by design, so whichever one
    // is currently driven high stands in for all of them.
    const pullResistance = this.topology.getArmPullResistance(highIndex);

    // The current flowing through the high-side pull resistor and the
    // current flowing through the low-side one are the same current — both
    // sides of one loop — so comparing them catches an inconsistent reading
    // before it can corrupt the result. This is an absolute (not relative)
    // comparison, since the current a non-conducting pair reads is legitimately
    // zero, where a relative tolerance would be meaningless.
    const currentFromHighSide = (this.highRailVoltage - highVoltage) / pullResistance;
    const currentFromLowSide = (lowVoltage - this.lowRailVoltage) / pullResistance;
    if (Math.abs(currentFromHighSide - currentFromLowSide) > this.currentConsistencyThreshold) {
      throw new NetworkSolverError(
        `Loop current identity violated: fromHighSide=${currentFromHighSide.toFixed(6)} mA, fromLowSide=${currentFromLowSide.toFixed(6)} mA`,
      );
    }

    const current = (currentFromHighSide + currentFromLowSide) / 2;
    if (current <= this.openCurrentThreshold) {
      return { conducts: false, pairResistance: NaN, lowResistanceFraction: NaN };
    }

    const voltageSpan = highVoltage - lowVoltage;
    const pairResistance = voltageSpan / current;
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

      return `${label}: ${(value * result.totalResistance).toFixed(1)} kΩ`;
    });

    const summary = `Solved — ${armDescriptions.join(", ")}`;

    // The total is still meaningful (and worth surfacing) even when an open
    // arm makes the other two individually unresolvable — it's only
    // undefined when nothing in the network is actually driving current.
    return Number.isNaN(result.totalResistance)
      ? summary
      : `${summary} (total: ${result.totalResistance.toFixed(1)} kΩ)`;
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
