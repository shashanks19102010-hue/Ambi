export function uid(
  prefix = "id"
) {
  return `${prefix}_${crypto.randomUUID()}`;
}