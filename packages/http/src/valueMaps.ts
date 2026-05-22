export interface HttpValueMaps {
  flat: Record<string, string | undefined>;
  multiValue: Record<string, string[] | undefined>;
}

export interface BuildValueMapsInput {
  single?: Record<string, string | undefined> | null;
  multi?: Record<string, string[] | undefined> | null;
  lowercaseKeys?: boolean;
}

// Build the flat and multi-value maps the HTTP layer exposes from an adapter's
// single-value and/or multi-value sources. A key present in the multi-value
// source wins over the single-value one, since AWS sends only one form per event.
export function buildValueMaps({ single, multi, lowercaseKeys = false }: BuildValueMapsInput): HttpValueMaps {
  const flat: Record<string, string | undefined> = {};
  const multiValue: Record<string, string[] | undefined> = {};
  const normaliseKey = (key: string): string => (lowercaseKeys ? key.toLowerCase() : key);

  if (single) {
    for (const [key, value] of Object.entries(single)) {
      const normalisedKey = normaliseKey(key);
      flat[normalisedKey] = value;
      multiValue[normalisedKey] = value === undefined ? undefined : [value];
    }
  }

  if (multi) {
    for (const [key, values] of Object.entries(multi)) {
      if (!values || values.length === 0) continue; // An empty array carries no value to expose
      const normalisedKey = normaliseKey(key);
      flat[normalisedKey] = values[values.length - 1];
      multiValue[normalisedKey] = values;
    }
  }

  return { flat, multiValue };
}
