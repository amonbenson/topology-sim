<script setup lang="ts">
import type { ResistorTap } from "@/stores/project";

const GRID = 16;
const STROKE = 2;
const JUNCTION_RADIUS = STROKE * 2;

const SPACING = 4 * GRID;
const DELTA_X = 7 * GRID;
const DELTA_Y = 6 * GRID;

const DELTA_CENTER_X = SPACING + DELTA_X;
const DELTA_CENTER_Y = SPACING + DELTA_X;
const DELTA_ARMS = [
  {
    tapX: SPACING + DELTA_X,
    tapY: SPACING,
    labelAlign: "start",
    labelOffsetX: 16,
    labelOffsetY: 0,
  },
  {
    tapX: SPACING + DELTA_X + DELTA_X,
    tapY: SPACING + DELTA_X + DELTA_Y,
    labelAlign: "start",
    labelOffsetX: 12,
    labelOffsetY: -16,
  },
  {
    tapX: SPACING,
    tapY: SPACING + DELTA_X + DELTA_Y,
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
const HEIGHT = SPACING + DELTA_X + DELTA_Y + SPACING * 3;

defineProps<{
  taps: ResistorTap[];
}>();
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
        :x1="DELTA_CENTER_X"
        :y1="DELTA_CENTER_Y"
        :x2="tapX"
        :y2="tapY"
      />

      <!-- Resistor Body -->
      <line
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
        R{{ i + 1 }}: {{ Math.round(taps[i].resistance) }} &#x3A9;
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
        {{ taps[i].voltage.toFixed(2) }} V
      </text>
    </template>

    <!-- Tap crossbars -->
    <template
      v-for="(tap, i) in taps"
      :key="i"
    >
      <!-- VCC -->
      <template v-if="tap.role === 'high'">
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
      </template>

      <!-- GND -->
      <template v-if="tap.role === 'low'">
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
      </template>
    </template>
  </svg>
</template>
