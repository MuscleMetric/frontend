// app/features/workouts/live/persist/persistControl.ts
type Controls = {
  pause: () => void;
  resume: () => void;
  cancelTimer?: () => void;
};

let controls: Controls | null = null;

export function registerPersistControls(next: Controls | null) {
  controls = next;
}

export function pauseLivePersist() {
  try {
    controls?.cancelTimer?.();
    controls?.pause();
  } catch {}
}

export function resumeLivePersist() {
  try {
    controls?.resume();
  } catch {}
}
