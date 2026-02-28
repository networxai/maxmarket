import type { Role } from "../../auth/types.js";
import { writeAudit } from "../../audit/audit-service.js";
import * as repo from "./repo.js";

export async function getUiStrings(language: string) {
  return repo.getUiStringsByLanguage(language);
}

export async function upsertUiStrings(
  language: string,
  strings: Record<string, string>,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  const result = await repo.upsertUiStrings(language, strings);
  await writeAudit({
    eventType: "i18n.strings_updated",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "ui_translations",
    targetId: null,
    payload: { language, keys: Object.keys(strings) },
    correlationId: opts.correlationId,
  });
  return result;
}
