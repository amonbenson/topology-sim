import { describe, expect, it } from "vitest";

import NetworkTopology, { NetworkTopologyError } from "./topology";

// Default configuration for every test: arm 0 = high (100Ω), arm 1 = floating
// (200Ω), arm 2 = low (300Ω), lowVoltage = 0V, highVoltage = 3.3V.

describe("NetworkTopology", () => {
  it("computes the star-point voltage for the default configuration", () => {
    const network = new NetworkTopology();

    expect(network.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(network.getArmVoltage(1)).toBeCloseTo(2.475);
    expect(network.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("reports the driven rail voltage for every arm sharing a role, not just one", () => {
    const network = new NetworkTopology();
    network.setArmRole(1, "low");

    expect(network.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(network.getArmVoltage(1)).toBeCloseTo(0);
    expect(network.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("settles a floating arm at the shared voltage when all driving arms agree", () => {
    const network = new NetworkTopology();
    network.setArmRole(1, "high");
    network.setArmRole(2, "floating");

    expect(network.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(network.getArmVoltage(1)).toBeCloseTo(3.3);
    expect(network.getArmVoltage(2)).toBeCloseTo(3.3);
  });

  it("reports NaN for every arm when all arms are floating", () => {
    const network = new NetworkTopology();
    network.setArmRole(0, "floating");
    network.setArmRole(2, "floating");

    expect(network.getArmVoltage(0)).toBeNaN();
    expect(network.getArmVoltage(1)).toBeNaN();
    expect(network.getArmVoltage(2)).toBeNaN();
  });

  it("isolates a floating arm with infinite resistance even while other arms are driven", () => {
    const network = new NetworkTopology();
    network.setArmResistance(1, Infinity);

    expect(network.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(network.getArmVoltage(1)).toBeNaN();
    expect(network.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("still reports the driven rail voltage for a low/high arm even if its own resistance is infinite", () => {
    const network = new NetworkTopology();
    network.setArmResistance(0, Infinity);

    expect(network.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(network.getArmVoltage(1)).toBeCloseTo(0);
    expect(network.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("reports NaN for a floating arm when every driving arm has infinite resistance", () => {
    const network = new NetworkTopology();
    network.setArmResistance(0, Infinity);
    network.setArmResistance(2, Infinity);

    expect(network.getArmVoltage(0)).toBeCloseTo(3.3);
    expect(network.getArmVoltage(1)).toBeNaN();
    expect(network.getArmVoltage(2)).toBeCloseTo(0);
  });

  it("recalculates automatically when a resistance changes after construction", () => {
    const network = new NetworkTopology();
    expect(network.getArmVoltage(1)).toBeCloseTo(2.475);

    network.setArmResistance(0, 300);
    expect(network.getArmVoltage(1)).toBeCloseTo(1.65);
  });

  it("recalculates when the low/high rail voltages change", () => {
    const network = new NetworkTopology();
    network.setHighVoltage(5);
    network.setLowVoltage(1);

    expect(network.getArmVoltage(0)).toBeCloseTo(5);
    expect(network.getArmVoltage(1)).toBeCloseTo(4);
    expect(network.getArmVoltage(2)).toBeCloseTo(1);
  });

  it("fires onVoltageChange whenever the configuration changes", () => {
    const network = new NetworkTopology();
    let fireCount = 0;
    network.onVoltageChange(() => {
      fireCount++;
    });

    network.setArmRole(1, "low");
    network.setArmResistance(0, 50);
    network.setLowVoltage(1);
    network.setHighVoltage(5);

    expect(fireCount).toBe(4);
  });

  it("throws for an out-of-range arm index", () => {
    const network = new NetworkTopology();

    expect(() => network.getArmRole(-1)).toThrow(NetworkTopologyError);
    expect(() => network.getArmRole(3)).toThrow(NetworkTopologyError);
    expect(() => network.getArmVoltage(99)).toThrow(NetworkTopologyError);
    expect(() => network.setArmRole(99, "low")).toThrow(NetworkTopologyError);
    expect(() => network.setArmResistance(99, 100)).toThrow(NetworkTopologyError);
  });
});
