export type RawIntentParams = {
  intent?: string;
  source?: string;
  filter?: string;
  stage?: string;
  overdue?: string;
  sinceDays?: string;
  ids?: string;
};

export function extractRawIntentParams(searchParams: URLSearchParams): RawIntentParams {
  const pick = (key: keyof RawIntentParams): string | undefined => {
    const value = searchParams.get(key);
    return value === null ? undefined : value;
  };

  return {
    intent: pick("intent"),
    source: pick("source"),
    filter: pick("filter"),
    stage: pick("stage"),
    overdue: pick("overdue"),
    sinceDays: pick("sinceDays"),
    ids: pick("ids"),
  };
}
