import type { WritableComputedRef } from "vue";
import { computed } from "vue";

import type { Event } from "@/utils/events";

import { useEvent } from "./useEvent";

export function useProperty<T, E = T>(
  getValue: () => T,
  setValue: (value: T) => void,
  onChange: Event<E>,
): WritableComputedRef<T> {
  const value = useEvent(onChange, getValue);

  return computed({
    get: () => value.value,
    set: setValue,
  });
}
