
/**
 * DOM操作工具函数
 */

export function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

export function getInputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
}

export function updateToggleLabel(showFollowedOnly: boolean): void {
  const toggleLabel = document.querySelector(".toggle-label");
  if (toggleLabel) {
    toggleLabel.textContent = showFollowedOnly ? "已关注" : "未关注";
  }
}
