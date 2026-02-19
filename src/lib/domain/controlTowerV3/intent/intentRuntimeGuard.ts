export function shouldApplyIntent(params: {
  hasIntent: boolean;
  hasUserModifiedState: boolean;
  hasAppliedIntentRef: { current: boolean };
}): boolean {
  if (!params.hasIntent) {
    return false;
  }

  if (params.hasUserModifiedState) {
    return false;
  }

  if (params.hasAppliedIntentRef.current) {
    return false;
  }

  params.hasAppliedIntentRef.current = true;
  return true;
}
