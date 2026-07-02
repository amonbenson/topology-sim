import { Property } from "@/utils/events";

export default class Resistor {
  private readonly resistance = new Property(100);

  readonly onResistanceChange = this.resistance.onChange;

  constructor(initialResistance: number = 100) {
    this.resistance.set(initialResistance);
  }

  getResistance(): number {
    return this.resistance.get();
  }

  setResistance(value: number): void {
    this.resistance.set(value);
  }
}
