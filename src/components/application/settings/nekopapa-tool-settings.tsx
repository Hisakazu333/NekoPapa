import { CollectionSettingsPanel } from "./nekopapa-collection-settings";

export function ToolSettingsPanel({ onClose }: { onClose: () => void }) {
  return <CollectionSettingsPanel collection="extensions" view="tools" onClose={onClose} />;
}

/** Skills are extension records with kind "skill", managed on their own page. */
export function SkillSettingsPanel({ onClose }: { onClose: () => void }) {
  return <CollectionSettingsPanel collection="extensions" view="skills" onClose={onClose} />;
}
