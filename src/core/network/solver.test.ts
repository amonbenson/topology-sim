import { describe, expect, it } from "vitest";

import NetworkSolver, { NetworkSolverError } from "./solver";
import NetworkTopology from "./topology";

function buildTopology(armResistances: readonly [number, number, number]): NetworkTopology {
  const topology = new NetworkTopology();
  for (const [index, resistance] of armResistances.entries()) {
    topology.setArmResistance(index, resistance);
  }

  return topology;
}

describe("NetworkSolver", () => {
  it("measures the topology's actual high rail voltage instead of assuming one", async () => {
    const topology = buildTopology([10, 22, 47]);
    topology.setHighVoltage(9);
    const solver = new NetworkSolver(topology);

    expect(solver.getHighRailVoltage()).toBeNaN();

    const result = await solver.solve();

    expect(solver.getHighRailVoltage()).toBeCloseTo(9);
    expect(solver.getLowRailVoltage()).toBeCloseTo(0);
    expect(result.totalResistance).toBeCloseTo(10 + 22 + 47);
  });

  it("measures the topology's actual low rail voltage instead of assuming it's 0", async () => {
    const topology = buildTopology([10, 22, 47]);
    topology.setLowVoltage(1.2);
    topology.setHighVoltage(4.5);
    const solver = new NetworkSolver(topology);

    expect(solver.getLowRailVoltage()).toBeNaN();

    const result = await solver.solve();

    expect(solver.getLowRailVoltage()).toBeCloseTo(1.2);
    expect(solver.getHighRailVoltage()).toBeCloseTo(4.5);
    expect(result.arms[0]).toBeCloseTo(10 / 79);
    expect(result.arms[1]).toBeCloseTo(22 / 79);
    expect(result.arms[2]).toBeCloseTo(47 / 79);
    expect(result.totalResistance).toBeCloseTo(79);
  });

  it("reads whatever pull resistance is actually configured, rather than assuming the 1kΩ default", async () => {
    const topology = buildTopology([10, 22, 47]);
    // All three arms share the same, non-default pull resistance — matching
    // the algorithm's assumption that every arm's pull resistance is equal.
    topology.setArmPullResistance(0, 5);
    topology.setArmPullResistance(1, 5);
    topology.setArmPullResistance(2, 5);
    const solver = new NetworkSolver(topology);

    const result = await solver.solve();

    expect(result.arms[0]).toBeCloseTo(10 / 79);
    expect(result.arms[1]).toBeCloseTo(22 / 79);
    expect(result.arms[2]).toBeCloseTo(47 / 79);
    expect(result.totalResistance).toBeCloseTo(79);
  });

  it("resolves a generic three-finite-arm topology into normalized ratios and the total resistance", async () => {
    const armResistances = [10, 22, 47] as const;
    const solver = new NetworkSolver(buildTopology(armResistances));
    const totalResistance = armResistances[0] + armResistances[1] + armResistances[2];

    const result = await solver.solve();

    expect(result.arms[0]).toBeCloseTo(armResistances[0] / totalResistance);
    expect(result.arms[1]).toBeCloseTo(armResistances[1] / totalResistance);
    expect(result.arms[2]).toBeCloseTo(armResistances[2] / totalResistance);
    expect(result.totalResistance).toBeCloseTo(totalResistance);
  });

  it("resolves a single zero arm as a regular case, not a short", async () => {
    const armResistances = [0, 100, 220] as const;
    const solver = new NetworkSolver(buildTopology(armResistances));
    const totalResistance = armResistances[0] + armResistances[1] + armResistances[2];

    const result = await solver.solve();

    expect(result.arms[0]).toBeCloseTo(0);
    expect(result.arms[1]).toBeCloseTo(armResistances[1] / totalResistance);
    expect(result.arms[2]).toBeCloseTo(armResistances[2] / totalResistance);
    expect(result.totalResistance).toBeCloseTo(totalResistance);
  });

  it("resolves directly from the first measurement when arm 2 is isolated (open)", async () => {
    const solver = new NetworkSolver(buildTopology([100, 900, Infinity]));

    const result = await solver.solve();

    expect(result.arms[0]).toBeNaN();
    expect(result.arms[1]).toBeNaN();
    expect(result.arms[2]).toBe(Infinity);
    expect(result.totalResistance).toBeCloseTo(100 + 900);
  });

  it("still reports the total resistance in the status text when individual arms are unresolved", async () => {
    const solver = new NetworkSolver(buildTopology([100, 900, Infinity]));

    await solver.solve();

    expect(solver.getStatus()).toContain("Tap 1: unresolved");
    expect(solver.getStatus()).toContain("Tap 3: open");
    expect(solver.getStatus()).toContain("total: 1000.0 kΩ");
  });

  it("omits the total resistance from the status text when it's undefined", async () => {
    const solver = new NetworkSolver(buildTopology([Infinity, Infinity, Infinity]));

    await solver.solve();

    expect(solver.getStatus()).not.toContain("total:");
  });

  it("falls back to a third measurement when arm 0 is isolated (open), since it's driven high in both other measurements and neither can conduct", async () => {
    const solver = new NetworkSolver(buildTopology([Infinity, 33, 47]));

    const result = await solver.solve();

    expect(result.arms[0]).toBe(Infinity);
    expect(result.arms[1]).toBeNaN();
    expect(result.arms[2]).toBeNaN();
    expect(result.totalResistance).toBeCloseTo(33 + 47);
  });

  it("resolves directly from the second measurement when arm 1 is isolated (open)", async () => {
    const solver = new NetworkSolver(buildTopology([47, Infinity, 100]));

    const result = await solver.solve();

    expect(result.arms[0]).toBeNaN();
    expect(result.arms[1]).toBe(Infinity);
    expect(result.arms[2]).toBeNaN();
    expect(result.totalResistance).toBeCloseTo(100 + 47);
  });

  it("reports every arm as open when the topology is fully disconnected", async () => {
    const solver = new NetworkSolver(buildTopology([Infinity, Infinity, Infinity]));

    const result = await solver.solve();

    expect(result.arms).toEqual([Infinity, Infinity, Infinity]);
    expect(result.totalResistance).toBeNaN();
  });

  it("detects an A-B terminal short with C still attached", async () => {
    const solver = new NetworkSolver(buildTopology([0, 0, 50]));

    const result = await solver.solve();

    expect(result.arms).toEqual([0, 0, 1]);
    expect(result.totalResistance).toBeCloseTo(50);
  });

  it("detects an arm 0-2 terminal short directly, since it's one of the two driven pairs", async () => {
    const solver = new NetworkSolver(buildTopology([0, 470, 0]));

    const result = await solver.solve();

    expect(result.arms).toEqual([0, 1, 0]);
    expect(result.totalResistance).toBeCloseTo(470);
  });

  it("detects an arm 1-2 terminal short via the generic extraction path (neither measured pair drives that combination directly)", async () => {
    const solver = new NetworkSolver(buildTopology([470, 0, 0]));

    const result = await solver.solve();

    expect(result.arms[0]).toBeCloseTo(1);
    expect(result.arms[1]).toBeCloseTo(0);
    expect(result.arms[2]).toBeCloseTo(0);
    expect(result.totalResistance).toBeCloseTo(470);
  });

  it("detects an A-B terminal short with C isolated (open)", async () => {
    const solver = new NetworkSolver(buildTopology([0, 0, Infinity]));

    const result = await solver.solve();

    expect(result.arms).toEqual([0, 0, Infinity]);
    expect(result.totalResistance).toBeNaN();
  });

  it("detects all three terminals shorted together", async () => {
    const solver = new NetworkSolver(buildTopology([0, 0, 0]));

    const result = await solver.solve();

    expect(result.arms).toEqual([0, 0, 0]);
    expect(result.totalResistance).toBeNaN();
  });

  it("resolves correctly when the shared arm is exactly zero, which makes both its resistance estimates zero too", async () => {
    // Arm 0 (shared between both measurements) is a genuine short, while its
    // pair sums (0+100=100, 0+220=220) stay well above the short threshold —
    // so neither shortcut check catches it, and this exercises the generic
    // resolution path's consistency check exactly at 0/0.
    const solver = new NetworkSolver(buildTopology([0, 100, 220]));

    const result = await solver.solve();

    expect(result.arms[0]).toBeCloseTo(0);
    expect(result.arms[1]).toBeCloseTo(100 / 320);
    expect(result.arms[2]).toBeCloseTo(220 / 320);
    expect(result.totalResistance).toBeCloseTo(320);
  });

  it("throws when the loop current disagrees between the high and low sides of a measurement", async () => {
    const topology = buildTopology([100, 200, 300]);
    const originalGetArmVoltage = topology.getArmVoltage.bind(topology);
    let callCount = 0;
    topology.getArmVoltage = (index: number): number => {
      callCount++;
      const voltage = originalGetArmVoltage(index);
      // The first two calls are the rail calibration (arm 0 driven alone);
      // from the third call onward, inject a fixed offset into arm 0's
      // reading. A real topology can never actually produce a mismatch here
      // — this simulates the kind of noisy/inconsistent reading real
      // hardware could.
      return callCount > 2 && index === 0 ? voltage - 0.01 : voltage;
    };

    const solver = new NetworkSolver(topology);

    await expect(solver.solve()).rejects.toThrow(/Loop current identity violated/);
  });

  it("throws when the two independent estimates of the shared arm's resistance disagree", () => {
    const solver = new NetworkSolver(buildTopology([100, 200, 300]));

    // This bypasses the public API to call the internal resolution step
    // directly, with two measurements that are individually well-formed but
    // mutually inconsistent about arm 0's resistance (100 vs. 150) — a
    // situation that can't arise from a real topology's own physics (see the
    // test above and below for that), but that real hardware noise could.
    const resolveFromBothMeasurements = (
      solver as unknown as {
        resolveFromBothMeasurements: (
          first: { conducts: true; pairResistance: number; lowResistanceFraction: number },
          second: { conducts: true; pairResistance: number; lowResistanceFraction: number },
        ) => unknown;
      }
    ).resolveFromBothMeasurements.bind(solver);

    const firstMeasurement = { conducts: true as const, pairResistance: 300, lowResistanceFraction: 200 / 300 }; // implies arm 0 = 100
    const secondMeasurement = { conducts: true as const, pairResistance: 450, lowResistanceFraction: 300 / 450 }; // implies arm 0 = 150

    expect(() => resolveFromBothMeasurements(firstMeasurement, secondMeasurement)).toThrow(NetworkSolverError);
  });

  it("recovers each arm's actual resistance from totalResistance times its normalized fraction", async () => {
    const armResistances = [150, 330, 220] as const;
    const solver = new NetworkSolver(buildTopology(armResistances));

    const result = await solver.solve();

    for (const [index, resistance] of armResistances.entries()) {
      expect(result.arms[index] * result.totalResistance).toBeCloseTo(resistance);
    }
  });

  it("resolves instantly with the default (zero) step delay, and still resolves with a configured delay", async () => {
    const instantSolver = new NetworkSolver(buildTopology([100, 200, 300]));
    const start = performance.now();
    await instantSolver.solve();
    expect(performance.now() - start).toBeLessThan(50);

    const delayedSolver = new NetworkSolver(buildTopology([100, 200, 300]), { stepDelayMs: 10 });
    const result = await delayedSolver.solve();
    expect(result.totalResistance).toBeCloseTo(600);
  });

  it("only ever reads tap voltages, never the topology's own rail setpoints", async () => {
    const topology = buildTopology([100, 200, 300]);
    const originalGetLowVoltage = topology.getLowVoltage;
    const originalGetHighVoltage = topology.getHighVoltage;

    let lowVoltageReadCount = 0;
    let highVoltageReadCount = 0;
    topology.getLowVoltage = (): number => {
      lowVoltageReadCount++;
      return originalGetLowVoltage.call(topology);
    };

    topology.getHighVoltage = (): number => {
      highVoltageReadCount++;
      return originalGetHighVoltage.call(topology);
    };

    await new NetworkSolver(topology).solve();

    expect(lowVoltageReadCount).toBe(0);
    expect(highVoltageReadCount).toBe(0);
  });

  it("throws when constructed with a topology that doesn't have exactly three arms", () => {
    const topology = buildTopology([100, 200, 300]);
    Object.defineProperty(topology, "armCount", { value: 4 });

    expect(() => new NetworkSolver(topology)).toThrow();
  });
});
