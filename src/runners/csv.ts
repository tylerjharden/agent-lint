/** Parse one RFC4180-ish CSV line (lizard --csv). */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let index = 0;
  while (index < line.length) {
    const ch = line[index];
    const next = line[index + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        index += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        index += 1;
        continue;
      }
      current += ch;
      index += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (ch === ",") {
      fields.push(current);
      current = "";
      index += 1;
      continue;
    }
    current += ch;
    index += 1;
  }
  fields.push(current);
  return fields;
}
