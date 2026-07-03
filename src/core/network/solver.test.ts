import { describe, expect, it } from "vitest";

import NetworkSolver from "./solver";
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

  it("reports the A-B pair as an unresolvable sum when C is isolated (open)", async () => {
    const solver = new NetworkSolver(buildTopology([100, 900, Infinity]));

    const result = await solver.solve();

    expect(result.arms[0]).toBeNaN();
    expect(result.arms[1]).toBeNaN();
    expect(result.arms[2]).toBe(Infinity);
    expect(result.totalResistance).toBeCloseTo(100 + 900);
  });

  it("reports the B-C pair as an unresolvable sum when A is isolated (open)", async () => {
    const solver = new NetworkSolver(buildTopology([Infinity, 33, 47]));

    const result = await solver.solve();

    expect(result.arms[0]).toBe(Infinity);
    expect(result.arms[1]).toBeNaN();
    expect(result.arms[2]).toBeNaN();
    expect(result.totalResistance).toBeCloseTo(33 + 47);
  });

  it("falls back to a third measurement when B is isolated (open), since neither of the first two pairs conducts", async () => {
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

  it("detects an A-C terminal short via the generic extraction path (not a directly driven pair)", async () => {
    const solver = new NetworkSolver(buildTopology([0, 470, 0]));

    const result = await solver.solve();

    expect(result.arms[0]).toBeCloseTo(0);
    expect(result.arms[1]).toBeCloseTo(1);
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

  it("recovers each arm's actual resistance from totalResistance times its normalized fraction", async () => {
    const armResistances = [150, 330, 220] as const;
    const solver = new NetworkSolver(buildTopology(armResistances));

    const result = await solver.solve();

    for (const [index, resistance] of armResistances.entries()) {
      expect(result.arms[index] * result.totalResistance).toBeCloseTo(resistance);
    }
  });

  it("reports status updates describing each measurement step and the final result", async () => {
    const solver = new NetworkSolver(buildTopology([100, 200, 300]));
    const statuses: string[] = [];
    solver.onStatusChange((status) => {
      statuses.push(status);
    });

    await solver.solve();

    expect(statuses[0]).toContain("Starting detection");
    expect(statuses[1]).toContain("Measuring high rail voltage");
    expect(statuses[2]).toContain("Measuring low rail voltage");
    expect(statuses[3]).toContain("Measured supply rails");
    expect(statuses[4]).toBe("Driving Tap 1 high, Tap 2 low, Tap 3 floating…");
    expect(statuses[5]).toBe("Driving Tap 2 high, Tap 3 low, Tap 1 floating…");
    expect(statuses.at(-1)).toContain("Solved —");
    expect(solver.getStatus()).toBe(statuses.at(-1));
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
