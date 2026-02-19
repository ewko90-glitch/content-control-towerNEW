export function isFencedWriter(params: { lockToken: string; currentTokenFromCache?: string }): boolean {
  if (!params.currentTokenFromCache) {
    return true;
  }

  return params.lockToken === params.currentTokenFromCache;
}
