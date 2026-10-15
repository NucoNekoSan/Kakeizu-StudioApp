import { useCallback, useEffect, useRef, useState } from "react";

/** Input generations remain dirty even when a user reverts to an older value. */
export function useTitleDraft(
  initial: string | undefined,
  save: (title: string) => Promise<unknown>,
) {
  const [value, setValue] = useState(initial ?? "");
  const [isDirty, setDirty] = useState(false);
  const draft = useRef({ value: initial ?? "", revision: 0, saved: 0 });
  const submitted = useRef<{
    revision: number;
    promise: Promise<void>;
    failed: boolean;
  } | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    if (initial === undefined || draft.current.revision !== draft.current.saved)
      return;
    draft.current.value = initial;
    setValue(initial);
  }, [initial]);
  const onChange = useCallback((next: string) => {
    if (draft.current.value === next) return;
    draft.current.value = next;
    draft.current.revision += 1;
    setValue(next);
    setDirty(true);
  }, []);
  const flush = useCallback((): Promise<void> => {
    const { value: title, revision, saved } = draft.current;
    if (revision === saved) return Promise.resolve();
    if (submitted.current?.revision === revision && !submitted.current.failed)
      return submitted.current.promise;
    const attempt = { revision, failed: false, promise: Promise.resolve() };
    attempt.promise = saveRef.current(title.trim()).then(
      () => {
        draft.current.saved = Math.max(draft.current.saved, revision);
        if (draft.current.revision === revision) setDirty(false);
      },
      (error) => {
        attempt.failed = true;
        throw error;
      },
    );
    submitted.current = attempt;
    void attempt.promise.catch(() => undefined);
    return attempt.promise;
  }, []);
  const flushAndWait = useCallback(async () => {
    while (draft.current.revision !== draft.current.saved) {
      const revision = draft.current.revision;
      try {
        await flush();
      } catch (error) {
        if (draft.current.revision === revision) throw error;
      }
    }
  }, [flush]);
  return { value, onChange, isDirty, flush, flushAndWait };
}
