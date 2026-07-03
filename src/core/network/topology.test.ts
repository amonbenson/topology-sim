import { describe, expect, it } from "vitest";

import NetworkTopology, { NetworkTopologyError } from "./topology";

// Default configuration for every test: arm 0 = high (100Ω), arm 1 = floating
// (200Ω), arm 2 = low (300Ω), lowVoltage = 0V, highVoltage = 3.3V.

describe("NetworkTopology", () => {
  it("computes the star-point voltage for the default configuration", () => {
    const topology = new NetworkTopology();

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(topology.getArmVoltage(1)).toBeCloseTo(2.475);
    expect(topology.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("reports the driven rail voltage for every arm sharing a role, not just one", () => {
    const topology = new NetworkTopology();
    topology.setArmRole(1, "low");

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(topology.getArmVoltage(1)).toBeCloseTo(0);
    expect(topology.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("settles a floating arm at the shared voltage when all driving arms agree", () => {
    const topology = new NetworkTopology();
    topology.setArmRole(1, "high");
    topology.setArmRole(2, "floating");

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(topology.getArmVoltage(1)).toBeCloseTo(3.3);
    expect(topology.getArmVoltage(2)).toBeCloseTo(3.3);
  });

  it("reports NaN for every arm when all arms are floating", () => {
    const topology = new NetworkTopology();
    topology.setArmRole(0, "floating");
    topology.setArmRole(2, "floating");

    expect(topology.getArmVoltage(0)).toBeNaN();
    expect(topology.getArmVoltage(1)).toBeNaN();
    expect(topology.getArmVoltage(2)).toBeNaN();
  });

  it("isolates a floating arm with infinite resistance even while other arms are driven", () => {
    const topology = new NetworkTopology();
    topology.setArmResistance(1, Infinity);

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(topology.getArmVoltage(1)).toBeNaN();
    expect(topology.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("still reports the driven rail voltage for a low/high arm even if its own resistance is infinite", () => {
    const topology = new NetworkTopology();
    topology.setArmResistance(0, Infinity);

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(topology.getArmVoltage(1)).toBeCloseTo(0);
    expect(topology.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("reports NaN for a floating arm when every driving arm has infinite resistance", () => {
    const topology = new NetworkTopology();
    topology.setArmResistance(0, Infinity);
    topology.setArmResistance(2, Infinity);

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(topology.getArmVoltage(1)).toBeNaN();
    expect(topology.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("recalculates automatically when a resistance changes after construction", () => {
    const topology = new NetworkTopology();
    expect(topology.getArmVoltage(1)).toBeCloseTo(2.475);

    topology.setArmResistance(0, 300);
    expect(topology.getArmVoltage(1)).toBeCloseTo(1.65);
  });

  it("recalculates when the low/high rail voltages change", () => {
    const topology = new NetworkTopology();
    topology.setHighVoltage(5);
    topology.setLowVoltage(1);

    expect(topology.getArmVoltage(0)).toBeCloseTo(5);
    expect(topology.getArmVoltage(1)).toBeCloseTo(4);
    expect(topology.getArmVoltage(2)).toBeCloseTo(1);
  });

  it("fires onVoltageChange whenever the configuration changes", () => {
    const topology = new NetworkTopology();
    let fireCount = 0;
    topology.onVoltageChange(() => {
      fireCount++;
    });

    topology.setArmRole(1, "low");
    topology.setArmResistance(0, 50);
    topology.setLowVoltage(1);
    topology.setHighVoltage(5);

    expect(fireCount).toBe(4);
  });

  it("throws for an out-of-range arm index", () => {
    const topology = new NetworkTopology();

    expect(() => topology.getArmRole(-1)).toThrow(NetworkTopologyError);
    expect(() => topology.getArmRole(3)).toThrow(NetworkTopologyError);
    expect(() => topology.getArmVoltage(99)).toThrow(NetworkTopologyError);
    expect(() => topology.setArmRole(99, "low")).toThrow(NetworkTopologyError);
    expect(() => topology.setArmResistance(99, 100)).toThrow(NetworkTopologyError);
  });
});
