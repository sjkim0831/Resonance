import { DependencyList, useEffect, useRef, useState } from "react";

type UseAsyncValueOptions<T> = {
  enabled?: boolean;
  onSuccess?: (value: T) => void;
  onError?: (error: Error) => void;
  initialValue?: T | null;
  skipInitialLoad?: boolean;
};

export function useAsyncValue<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  options: UseAsyncValueOptions<T> = {}
) {
  const { enabled = true, onSuccess, onError, initialValue = null, skipInitialLoad = false } = options;
  const [value, setValue] = useState<T | null>(initialValue);
  const [loading, setLoading] = useState(enabled && !(skipInitialLoad && initialValue !== null));
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const appliedInitialValueRef = useRef<T | null>(null);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onError, onSuccess]);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function reload() {
    if (!enabled) {
      setLoading(false);
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError("");

    try {
      const nextValue = await load();
      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return nextValue;
      }
      setValue(nextValue);
      if (isMountedRef.current) {
        onSuccessRef.current?.(nextValue);
      }
      return nextValue;
    } catch (nextError) {
      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return null;
      }
      const resolvedError = nextError instanceof Error ? nextError : new Error("Request failed");
      setError(resolvedError.message);
      if (isMountedRef.current) {
        onErrorRef.current?.(resolvedError);
      }
      return null;
    } finally {
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (skipInitialLoad && initialValue !== null) {
      setLoading(false);
      setValue(initialValue);
      if (appliedInitialValueRef.current !== initialValue) {
        appliedInitialValueRef.current = initialValue;
        onSuccessRef.current?.(initialValue);
      }
      return;
    }
    appliedInitialValueRef.current = null;
    void reload();
  }, [enabled, initialValue, skipInitialLoad, ...deps]);

  return {
    value,
    setValue,
    loading,
    error,
    setError,
    reload
  };
}
