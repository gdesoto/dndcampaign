export function recapWatchLink(basePath: string, recapId: string): string {
  return `${basePath}/watch?recap=${encodeURIComponent(recapId)}`
}
