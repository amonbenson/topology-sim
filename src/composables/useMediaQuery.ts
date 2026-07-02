import type { Ref } from "vue";
import { onScopeDispose, ref } from "vue";

export function useMediaQuery(query: string): Ref<boolean> {
  const mediaQueryList = window.matchMedia(query);
  const matches = ref(mediaQueryList.matches);

  const listener = (event: MediaQueryListEvent): void => {
    matches.value = event.matches;
  };

  mediaQueryList.addEventListener("change", listener);
  onScopeDispose(() => mediaQueryList.removeEventListener("change", listener));

  return matches;
}
