/**
 * 路径脱敏与错误信息清理（UI 展示用，不影响配置存储）。
 */

const SENSITIVE_PATTERN =
  /(token|bearer|cookie|api[_-]?key|authorization|sk-[A-Za-z0-9]{8,})/gi;

/** 将绝对路径脱敏为 `E:\...\folder\file.py` 形式。 */
export function redactPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  if (parts.length <= 2) return trimmed;

  const drive = /^[A-Za-z]:$/.test(parts[0]) ? parts[0] : null;
  const tail = parts.slice(-2).join("\\");
  if (drive) return `${drive}\\...\\${tail}`;
  return `...\\${tail}`;
}

/** 清理错误文本：脱敏敏感关键字，截断过长输出，移除 stdout 片段。 */
export function sanitizeErrorMessage(raw: string): string {
  let text = raw.replace(SENSITIVE_PATTERN, "[REDACTED]");
  // 避免把完整命令行或长路径堆进 UI
  text = text.replace(/[A-Za-z]:\\[^\s]{40,}/g, (match) => redactPath(match));
  if (text.length > 240) {
    text = `${text.slice(0, 240)}…`;
  }
  return text.trim();
}
