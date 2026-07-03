<script setup lang="ts">
import type { ResistorArm } from "@/stores/project";

const GRID = 16;
const STROKE = 2;
const JUNCTION_RADIUS = STROKE * 2;

const SPACING = GRID * 4;
const DELTA_X = GRID * 7;
const DELTA_Y = GRID * 6;

const DELTA_CENTER_X = SPACING + DELTA_X;
const DELTA_CENTER_Y = SPACING * 2 + DELTA_X;
const DELTA_ARMS = [
  {
    tapX: SPACING + DELTA_X,
    tapY: SPACING * 2,
    labelAlign: "start",
    labelOffsetX: 16,
    labelOffsetY: 0,
  },
  {
    tapX: SPACING + DELTA_X + DELTA_X,
    tapY: SPACING * 2 + DELTA_X + DELTA_Y,
    labelAlign: "start",
    labelOffsetX: 12,
    labelOffsetY: -16,
  },
  {
    tapX: SPACING,
    tapY: SPACING * 2 + DELTA_X + DELTA_Y,
    labelAlign: "end",
    labelOffsetX: -12,
    labelOffsetY: -16,
  },
];

const TAP_WIRE_YS = [
  DELTA_ARMS[0].tapY,
  DELTA_ARMS[1].tapY,
  DELTA_ARMS[2].tapY + SPACING * 2,
];

const TAP_WIRE_EX = DELTA_ARMS[1].tapX + SPACING * 5;
const GND_X = TAP_WIRE_EX - SPACING * 2;
const VCC_X = TAP_WIRE_EX - SPACING * 3;

const WIDTH = SPACING + DELTA_X * 2 + SPACING * 6;
const HEIGHT = SPACING + DELTA_X + DELTA_Y + SPACING * 5;

defineProps<{
  arms: ResistorArm[];
}>();

function formatResistance(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : "∞";
}

function formatVoltage(value: number): string {
  return Number.isNaN(value) ? "???" : String(value.toFixed(2));
}
</script>

<template>
  <svg
    :view-box="`0 0 ${WIDTH} ${HEIGHT}`"
    :style="{
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`
    }"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    stroke="currentColor"
    :stroke-width="STROKE"
  >
    <!-- Delta resistors and outer tap junctions -->
    <template
      v-for="{ tapX, tapY, labelAlign, labelOffsetX, labelOffsetY }, i in DELTA_ARMS"
      :key="i"
    >
      <!-- Resistor Wire -->
      <line
        v-if="arms[i].resistance < Infinity"
        :x1="DELTA_CENTER_X"
        :y1="DELTA_CENTER_Y"
        :x2="tapX"
        :y2="tapY"
      />

      <!-- Resistor Body -->
      <line
        v-if="arms[i].resistance > 0 && arms[i].resistance < Infinity"
        :x1="DELTA_CENTER_X + (tapX - DELTA_CENTER_X) * 0.33"
        :y1="DELTA_CENTER_Y + (tapY - DELTA_CENTER_Y) * 0.33"
        :x2="DELTA_CENTER_X + (tapX - DELTA_CENTER_X) * 0.66"
        :y2="DELTA_CENTER_Y + (tapY - DELTA_CENTER_Y) * 0.66"
        stroke-width="20"
      />

      <!-- Label -->
      <text
        :x="DELTA_CENTER_X + (tapX - DELTA_CENTER_X) * 0.5 + labelOffsetX"
        :y="DELTA_CENTER_Y + (tapY - DELTA_CENTER_Y) * 0.5 + labelOffsetY"
        :text-anchor="labelAlign"
        dominant-baseline="middle"
        font-size="16"
        stroke="none"
        fill="currentColor"
      >
        R{{ i + 1 }}: {{ formatResistance(arms[i].resistance) }} k&#x3A9;
      </text>

      <!-- Tap junction -->
      <circle
        :cx="tapX"
        :cy="tapY"
        :r="JUNCTION_RADIUS"
        fill="currentColor"
        stroke="none"
      />
    </template>

    <!-- Delta center junction -->
    <circle
      :cx="DELTA_CENTER_X"
      :cy="DELTA_CENTER_Y"
      :r="JUNCTION_RADIUS"
      fill="currentColor"
      stroke="none"
    />

    <!-- Tap wires -->
    <line
      :x1="DELTA_ARMS[0].tapX"
      :y1="TAP_WIRE_YS[0]"
      :x2="TAP_WIRE_EX"
      :y2="TAP_WIRE_YS[0]"
    />
    <line
      :x1="DELTA_ARMS[1].tapX"
      :y1="TAP_WIRE_YS[1]"
      :x2="TAP_WIRE_EX"
      :y2="TAP_WIRE_YS[1]"
    />
    <line
      :x1="DELTA_ARMS[2].tapX"
      :y1="DELTA_ARMS[2].tapY"
      :x2="DELTA_ARMS[2].tapX"
      :y2="TAP_WIRE_YS[2]"
    />
    <line
      :x1="DELTA_ARMS[2].tapX"
      :y1="TAP_WIRE_YS[2]"
      :x2="TAP_WIRE_EX"
      :y2="TAP_WIRE_YS[2]"
    />

    <!-- Tap end-junctions -->
    <template
      v-for="(tapY, i) in TAP_WIRE_YS"
      :key="i"
    >
      <circle
        :cx="TAP_WIRE_EX"
        :cy="tapY"
        :r="JUNCTION_RADIUS"
        fill="currentColor"
        stroke="none"
      />
      <text
        :x="TAP_WIRE_EX + 16"
        :y="tapY"
        dominant-baseline="middle"
        font-size="16"
        stroke="none"
        fill="currentColor"
      >
        {{ formatVoltage(arms[i].voltage) }} V
      </text>

      <!-- Measurement resistor body -->
      <line
        v-if="arms[i].resistance > 0 && arms[i].resistance < Infinity"
        :x1="TAP_WIRE_EX - SPACING * 1.25"
        :y1="tapY"
        :x2="TAP_WIRE_EX - SPACING * 0.75"
        :y2="tapY"
        stroke-width="20"
      />
      <text
        :x="TAP_WIRE_EX - SPACING"
        :y="tapY - 20"
        dominant-baseline="middle"
        text-anchor="middle"
        font-size="16"
        stroke="none"
        fill="currentColor"
      >
        RM: {{ formatResistance(arms[i].measurementResistance) }} k&#x3A9;
      </text>
    </template>

    <!-- Tap crossbars -->
    <template
      v-for="(arm, i) in arms"
      :key="i"
    >
      <!-- VCC -->
      <template v-if="arm.role === 'high'">
        <line
          :x1="VCC_X"
          :y1="SPACING / 2"
          :x2="VCC_X"
          :y2="TAP_WIRE_YS[i]"
          stroke="#f40"
        />
        <circle
          :cx="VCC_X"
          :cy="TAP_WIRE_YS[i]"
          :r="JUNCTION_RADIUS"
          fill="#f40"
          stroke="none"
        />
        <line
          :x1="VCC_X - SPACING / 4"
          :y1="SPACING / 2"
          :x2="VCC_X + SPACING / 4"
          :y2="SPACING / 2"
          stroke="#f40"
        />

        <line
          :x1="VCC_X"
          :y1="SPACING * 1"
          :x2="VCC_X"
          :y2="SPACING * 1.5"
          stroke="#f40"
          stroke-width="20"
        />
        <text
          :x="VCC_X + 20"
          :y="SPACING * 1.25"
          dominant-baseline="middle"
          text-anchor="left"
          font-size="16"
          stroke="none"
          fill="#f40"
        >
          RP: {{ formatResistance(arm.pullResistance) }} k&#x3A9;
        </text>
      </template>

      <!-- GND -->
      <template v-if="arm.role === 'low'">
        <line
          :x1="GND_X"
          :y1="HEIGHT - SPACING / 2"
          :x2="GND_X"
          :y2="TAP_WIRE_YS[i]"
          stroke="#04f"
        />
        <circle
          :cx="GND_X"
          :cy="TAP_WIRE_YS[i]"
          :r="JUNCTION_RADIUS"
          fill="#04f"
          stroke="none"
        />
        <line
          :x1="GND_X - SPACING / 4"
          :y1="HEIGHT - SPACING / 2"
          :x2="GND_X + SPACING / 4"
          :y2="HEIGHT - SPACING / 2"
          stroke="#04f"
        />

        <line
          :x1="GND_X"
          :y1="HEIGHT - SPACING * 1"
          :x2="GND_X"
          :y2="HEIGHT - SPACING * 1.5"
          stroke="#04f"
          stroke-width="20"
        />
        <text
          :x="GND_X + 20"
          :y="HEIGHT - SPACING * 1.25"
          dominant-baseline="middle"
          text-anchor="left"
          font-size="16"
          stroke="none"
          fill="#04f"
        >
          RP: {{ formatResistance(arm.pullResistance) }} k&#x3A9;
        </text>
      </template>
    </template>
  </svg>
</template>
