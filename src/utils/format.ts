/** « 248 Ko », « 1,2 Mo » */
export const fmtSize = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
};

/** « 1,2 L », « 1,45 L » */
export const fmtLitres = (ml: number): string => {
  const litres = Math.round(ml / 10) / 100;
  return `${String(litres).replace('.', ',')} L`;
};
