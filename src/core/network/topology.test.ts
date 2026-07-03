import { describe, expect, it } from "vitest";

import NetworkTopology, { NetworkTopologyError } from "./topology";

// Default configuration for every test: arm 0 = high (100kΩ), arm 1 =
// floating (200kΩ), arm 2 = low (300kΩ), lowVoltage = 0V, highVoltage = 3.3V.
// Every arm also has a 1kΩ pull resistance and a 1kΩ measurement resistance
// by default (2kΩ combined), which is why a driven arm's own tap voltage is
// close to — but not exactly — its rail voltage.

describe("NetworkTopology", () => {
  it("computes the star-point voltage for the default configuration", () => {
    const topology = new NetworkTopology();

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.2837, 3);
    expect(topology.getArmVoltage(1)).toBeCloseTo(2.4668, 3);
    expect(topology.getArmVoltage(2)).toBeCloseTo(0.0163, 3);
  });

  it("allows multiple arms to share the same driven role, each with its own voltage", () => {
    const topology = new NetworkTopology();
    topology.setArmRole(1, "low");

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.2704, 3);
    expect(topology.getArmVoltage(1)).toBeCloseTo(0.0177, 3);
    expect(topology.getArmVoltage(2)).toBeCloseTo(0.0119, 3);
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

    expect(topology.getArmVoltage(0)).toBeCloseTo(3.2837, 3);
    expect(topology.getArmVoltage(1)).toBeNaN();
    expect(topology.getArmVoltage(2)).toBeCloseTo(0.0163, 3);
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
    expect(topology.getArmVoltage(1)).toBeCloseTo(2.4668, 3);

    topology.setArmResistance(0, 300);
    expect(topology.getArmVoltage(1)).toBeCloseTo(1.65);
  });

  it("recalculates when the low/high rail voltages change", () => {
    const topology = new NetworkTopology();
    topology.setHighVoltage(5);
    topology.setLowVoltage(1);

    expect(topology.getArmVoltage(0)).toBeCloseTo(4.9802, 3);
    expect(topology.getArmVoltage(1)).toBeCloseTo(3.9901, 3);
    expect(topology.getArmVoltage(2)).toBeCloseTo(1.0198, 3);
  });

  it("recalculates automatically when a pull or measurement resistance changes", () => {
    const topology = new NetworkTopology();
    const before = topology.getArmVoltage(1);

    topology.setArmPullResistance(0, 50);
    expect(topology.getArmVoltage(1)).not.toBeCloseTo(before, 6);

    topology.setArmPullResistance(0, 1);
    topology.setArmMeasurementResistance(2, 50);
    expect(topology.getArmVoltage(1)).not.toBeCloseTo(before, 6);
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
    topology.setArmPullResistance(0, 2);
    topology.setArmMeasurementResistance(0, 2);

    expect(fireCount).toBe(6);
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
