import type { ComputedRef } from "vue";
import { computed, onScopeDispose, shallowRef } from "vue";

import type { Event } from "@/utils/events";

export function useEvent<T, U = T>(event: Event<T>, getValue: () => U): ComputedRef<U> {
  const revision = shallowRef(0);

  const subscription = event(() => {
    revision.value++;
  });
  onScopeDispose(() => subscription.dispose());

  return computed(() => {
    void revision.value;
    return getValue();
  });
}
