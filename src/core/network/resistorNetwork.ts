import { Emitter, type Event } from "@/utils/events";

import Resistor from "./resistor";

export class ResistorNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResistorNetworkError";
  }
}

export class InvalidTapConfigurationError extends ResistorNetworkError {
  constructor(lowTapIndex: number, highTapIndex: number) {
    super(`Invalid tap configuration: low=${lowTapIndex}, high=${highTapIndex}`);
    this.name = "InvalidTapConfigurationError";
  }
}

export default class ResistorNetwork {
  public readonly resistors = [
    new Resistor(100),
    new Resistor(200),
    new Resistor(300),
  ];

  private lowTapIndex = 0;
  private highTapIndex = 1;
  private outputTapIndex = 2;

  private lowVoltage = 0;
  private highVoltage = 3.3;
  private outputVoltage = 0;

  private readonly configurationChangeEmitter = new Emitter<void>();
  readonly onConfigurationChange: Event<void> = this.configurationChangeEmitter.event;

  constructor() {
    for (const resistor of this.resistors) {
      resistor.onResistanceChange(() => {
        this.recalculateOutputVoltage();
        this.configurationChangeEmitter.fire();
      });
    }

    this.recalculateOutputVoltage();
  }

  getLowTapIndex(): number {
    return this.lowTapIndex;
  }

  getHighTapIndex(): number {
    return this.highTapIndex;
  }

  getOutputTapIndex(): number {
    return this.outputTapIndex;
  }

  getVoltageAt(tapIndex: number): number {
    if (tapIndex === this.lowTapIndex) {
      return this.lowVoltage;
    }

    if (tapIndex === this.highTapIndex) {
      return this.highVoltage;
    }

    if (tapIndex === this.outputTapIndex) {
      return this.outputVoltage;
    }

    throw new ResistorNetworkError(`No tap exists at index: ${tapIndex}`);
  }

  setLowVoltage(value: number): void {
    this.lowVoltage = value;
    this.recalculateOutputVoltage();
    this.configurationChangeEmitter.fire();
  }

  setHighVoltage(value: number): void {
    this.highVoltage = value;
    this.recalculateOutputVoltage();
    this.configurationChangeEmitter.fire();
  }

  setTapConfiguration(lowTapIndex: number, highTapIndex: number): void {
    if (lowTapIndex < 0 || lowTapIndex >= this.resistors.length) {
      throw new InvalidTapConfigurationError(lowTapIndex, highTapIndex);
    }

    if (highTapIndex < 0 || highTapIndex >= this.resistors.length) {
      throw new InvalidTapConfigurationError(lowTapIndex, highTapIndex);
    }

    if (lowTapIndex === highTapIndex) {
      throw new InvalidTapConfigurationError(lowTapIndex, highTapIndex);
    }

    this.lowTapIndex = lowTapIndex;
    this.highTapIndex = highTapIndex;
    this.outputTapIndex = 3 - lowTapIndex - highTapIndex;

    this.recalculateOutputVoltage();
    this.configurationChangeEmitter.fire();
  }

  private recalculateOutputVoltage(): void {
    const lowResistance = this.resistors[this.lowTapIndex].getResistance();
    const highResistance = this.resistors[this.highTapIndex].getResistance();

    // As the output tap is floating, we can assume the star point center voltage to be the same as the output voltage.
    // This reduces the calculation to a simple voltage divider between the low and high tap resistors.
    this.outputVoltage = (this.highVoltage * lowResistance + this.lowVoltage * highResistance) / (lowResistance + highResistance);
  }
}
