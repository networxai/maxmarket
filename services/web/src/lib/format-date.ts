import { languageRef } from "./language-ref";

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(languageRef.current, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat(languageRef.current, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(date));
}
