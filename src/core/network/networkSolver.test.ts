import { describe, expect, it } from "vitest";

import NetworkSolver from "./networkSolver";
import ResistorNetwork from "./resistorNetwork";

function buildNetwork(armResistances: readonly [number, number, number]): ResistorNetwork {
  const network = new ResistorNetwork();
  for (const [index, resistance] of armResistances.entries()) {
    network.setArmResistance(index, resistance);
  }

  return network;
}

describe("NetworkSolver", () => {
  it("resolves a generic three-finite-arm network into normalized ratios and the total resistance", () => {
    const armResistances = [10, 22, 47] as const;
    const solver = new NetworkSolver(buildNetwork(armResistances));
    const totalResistance = armResistances[0] + armResistances[1] + armResistances[2];

    const result = solver.solve();

    expect(result.arms[0]).toBeCloseTo(armResistances[0] / totalResistance);
    expect(result.arms[1]).toBeCloseTo(armResistances[1] / totalResistance);
    expect(result.arms[2]).toBeCloseTo(armResistances[2] / totalResistance);
    expect(result.totalResistance).toBeCloseTo(totalResistance);
  });

  it("resolves a single zero arm as a regular case, not a short", () => {
    const armResistances = [0, 100, 220] as const;
    const solver = new NetworkSolver(buildNetwork(armResistances));
    const totalResistance = armResistances[0] + armResistances[1] + armResistances[2];

    const result = solver.solve();

    expect(result.arms[0]).toBeCloseTo(0);
    expect(result.arms[1]).toBeCloseTo(armResistances[1] / totalResistance);
    expect(result.arms[2]).toBeCloseTo(armResistances[2] / totalResistance);
    expect(result.totalResistance).toBeCloseTo(totalResistance);
  });

  it("reports the A-B pair as an unresolvable sum when C is isolated (open)", () => {
    const solver = new NetworkSolver(buildNetwork([100, 900, Infinity]));

    const result = solver.solve();

    expect(result.arms[0]).toBeNaN();
    expect(result.arms[1]).toBeNaN();
    expect(result.arms[2]).toBe(Infinity);
    expect(result.totalResistance).toBeCloseTo(100 + 900);
  });

  it("reports the B-C pair as an unresolvable sum when A is isolated (open)", () => {
    const solver = new NetworkSolver(buildNetwork([Infinity, 33, 47]));

    const result = solver.solve();

    expect(result.arms[0]).toBe(Infinity);
    expect(result.arms[1]).toBeNaN();
    expect(result.arms[2]).toBeNaN();
    expect(result.totalResistance).toBeCloseTo(33 + 47);
  });

  it("falls back to a third measurement when B is isolated (open), since neither of the first two pairs conducts", () => {
    const solver = new NetworkSolver(buildNetwork([47, Infinity, 100]));

    const result = solver.solve();

    expect(result.arms[0]).toBeNaN();
    expect(result.arms[1]).toBe(Infinity);
    expect(result.arms[2]).toBeNaN();
    expect(result.totalResistance).toBeCloseTo(100 + 47);
  });

  it("reports every arm as open when the network is fully disconnected", () => {
    const solver = new NetworkSolver(buildNetwork([Infinity, Infinity, Infinity]));

    const result = solver.solve();

    expect(result.arms).toEqual([Infinity, Infinity, Infinity]);
    expect(result.totalResistance).toBeNaN();
  });

  it("detects an A-B terminal short with C still attached", () => {
    const solver = new NetworkSolver(buildNetwork([0, 0, 50]));

    const result = solver.solve();

    expect(result.arms).toEqual([0, 0, 1]);
    expect(result.totalResistance).toBeCloseTo(50);
  });

  it("detects an A-C terminal short via the generic extraction path (not a directly driven pair)", () => {
    const solver = new NetworkSolver(buildNetwork([0, 470, 0]));

    const result = solver.solve();

    expect(result.arms[0]).toBeCloseTo(0);
    expect(result.arms[1]).toBeCloseTo(1);
    expect(result.arms[2]).toBeCloseTo(0);
    expect(result.totalResistance).toBeCloseTo(470);
  });

  it("detects an A-B terminal short with C isolated (open)", () => {
    const solver = new NetworkSolver(buildNetwork([0, 0, Infinity]));

    const result = solver.solve();

    expect(result.arms).toEqual([0, 0, Infinity]);
    expect(result.totalResistance).toBeNaN();
  });

  it("detects all three terminals shorted together", () => {
    const solver = new NetworkSolver(buildNetwork([0, 0, 0]));

    const result = solver.solve();

    expect(result.arms).toEqual([0, 0, 0]);
    expect(result.totalResistance).toBeNaN();
  });

  it("recovers each arm's actual resistance from totalResistance times its normalized fraction", () => {
    const armResistances = [150, 330, 220] as const;
    const solver = new NetworkSolver(buildNetwork(armResistances));

    const result = solver.solve();

    for (const [index, resistance] of armResistances.entries()) {
      expect(result.arms[index] * result.totalResistance).toBeCloseTo(resistance);
    }
  });

  it("only ever reads tap voltages, never the network's own rail setpoints", () => {
    const network = buildNetwork([100, 200, 300]);
    const originalGetLowVoltage = network.getLowVoltage;
    const originalGetHighVoltage = network.getHighVoltage;

    let lowVoltageReadCount = 0;
    let highVoltageReadCount = 0;
    network.getLowVoltage = (): number => {
      lowVoltageReadCount++;
      return originalGetLowVoltage.call(network);
    };

    network.getHighVoltage = (): number => {
      highVoltageReadCount++;
      return originalGetHighVoltage.call(network);
    };

    new NetworkSolver(network).solve();

    expect(lowVoltageReadCount).toBe(0);
    expect(highVoltageReadCount).toBe(0);
  });

  it("throws when constructed with a network that doesn't have exactly three arms", () => {
    const network = buildNetwork([100, 200, 300]);
    Object.defineProperty(network, "armCount", { value: 4 });

    expect(() => new NetworkSolver(network)).toThrow();
  });
});
