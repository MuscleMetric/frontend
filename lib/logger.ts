export function log(...args: any[]) {
  if (__DEV__) log(...args);
}

export function warn(...args: any[]) {
  if (__DEV__) console.warn(...args);
}

export function error(...args: any[]) {
  if (__DEV__) console.error(...args);
}