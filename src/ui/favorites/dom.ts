export function createLink(
  href: string,
  text?: string,
  className?: string
): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noreferrer";
  if (text) a.textContent = text;
  if (className) a.className = className;
  return a;
}
