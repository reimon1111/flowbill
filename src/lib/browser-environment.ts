/** LINE アプリ内ブラウザ（WebView）かどうか */
export function isLineInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Line\//i.test(navigator.userAgent) || /\bLINE\b/i.test(navigator.userAgent);
}
