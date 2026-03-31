export const stableHash = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const stableNumber = (value: string): number =>
  Number.parseInt(stableHash(value), 16) / 0xffffffff;

export const stableColor = (value: string, alpha = 1): string => {
  const hash = stableHash(value);
  const red = Number.parseInt(hash.slice(0, 2), 16);
  const green = Number.parseInt(hash.slice(2, 4), 16);
  const blue = Number.parseInt(hash.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
