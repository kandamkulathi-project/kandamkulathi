/** Memory-only logout fence owned above lifecycle-remounted native session controls. */
export function nativeSessionLifecycle() {
  let blocked = false;
  let generation = 0;
  return {
    isBlocked: () => blocked,
    begin() {
      const attempt = ++generation;
      return () => !blocked && generation === attempt;
    },
    suspend() {
      generation++;
    },
    resume(revalidate: () => void) {
      if (!blocked) revalidate();
    },
    block() {
      blocked = true;
      generation++;
    },
    // Only the explicit user refresh calls this, never AppState or an expiry callback.
    retry() {
      blocked = false;
      generation++;
    },
  };
}
