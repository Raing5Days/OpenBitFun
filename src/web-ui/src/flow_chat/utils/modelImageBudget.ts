import type { AIModelConfig } from '@/infrastructure/config/types';
import { getEffectiveModelCapabilities, isSelectableTextChatModel } from '@/infrastructure/config/services/modelCategory';

/** Every native image route must accept the draft before automatic selection. */
export function modelSelectionImageLimit(
  models: readonly AIModelConfig[],
  primary?: AIModelConfig | null,
  poolMemberIds?: readonly string[],
): number | undefined {
  // Pool membership and candidate ids are looked up once per model, not per pair, and the
  // candidate set is built without intermediate arrays: this runs on every draft change.
  const memberIds = poolMemberIds ? new Set(poolMemberIds) : undefined;
  const roots = memberIds
    ? models.filter(model => model.id && memberIds.has(model.id))
    : primary
      ? [primary]
      : [];

  const candidateIds = new Set<string>();
  for (const model of roots) {
    if (!isSelectableTextChatModel(model)) continue;
    const manualChannel = model.channel_routing?.manual_channel;
    if (manualChannel) {
      candidateIds.add(manualChannel);
      continue;
    }
    candidateIds.add(model.id);
    for (const fallbackId of model.channel_routing?.fallback_model_ids ?? []) {
      candidateIds.add(fallbackId);
    }
  }

  let limit: number | undefined;
  for (const model of models) {
    if (!candidateIds.has(model.id)) continue;
    if (!isSelectableTextChatModel(model)) continue;
    if (!getEffectiveModelCapabilities(model).includes('image_understanding')) continue;
    const candidate = model.max_images_per_request;
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate <= 0) continue;
    limit = limit === undefined ? candidate : Math.min(limit, candidate);
  }
  return limit;
}
