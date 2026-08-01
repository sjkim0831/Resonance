import { Dispatch, SetStateAction, useEffect } from 'react';

export const selectedProjectStorageKey = 'resonance.selectedProjectId';

export function getSharedProjectId(fallback = 'CCUS-PLATFORM') {
  return window.localStorage.getItem(selectedProjectStorageKey) ?? fallback;
}

export function useSharedProjectSelection(
  projectId: string,
  setProjectId: Dispatch<SetStateAction<string>>,
) {
  useEffect(() => {
    const stored = getSharedProjectId(projectId);
    if (stored !== projectId) setProjectId(stored);
    const onProjectChanged = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (next) setProjectId(next);
    };
    window.addEventListener('resonance-project-changed', onProjectChanged);
    return () =>
      window.removeEventListener('resonance-project-changed', onProjectChanged);
  }, [setProjectId]);

  useEffect(() => {
    if (projectId)
      window.localStorage.setItem(selectedProjectStorageKey, projectId);
  }, [projectId]);
}
