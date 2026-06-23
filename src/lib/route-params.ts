/** Next.js App Router の動的セグメント id を解決 */
export function resolveRouteId(param: string | string[] | undefined): string {
  if (typeof param === "string") return param;
  if (Array.isArray(param)) return param[0] ?? "";
  return "";
}
