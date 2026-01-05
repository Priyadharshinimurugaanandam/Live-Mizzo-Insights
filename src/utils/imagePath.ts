// src/utils/imagePath.ts
export const normalize = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with _
    .replace(/^_+|_+$/g, '');     // Remove leading/trailing _

export const getSurgeonImage = (name: string): string =>
  `/surgeons/${normalize(name)}.png`;

export const getInstrumentImage = (name: string): string =>
  `/instruments/${normalize(name)}.png`;