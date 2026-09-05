'use client';

import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useApi<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef.current().then(
      (result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setError(messageOf(err));
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [...deps, tick]);

  return { data, error, loading, reload };
}

export interface MutationState<Args extends unknown[], R> {
  run: (...args: Args) => Promise<R | undefined>;
  pending: boolean;
  error: string | null;
  clearError: () => void;
}

export function useMutation<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
): MutationState<Args, R> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args: Args): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      setError(messageOf(err));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { run, pending, error, clearError };
}
