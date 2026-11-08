import { CollectionSettingsPanel } from "./nekopapa-collection-settings";

export function ToolSettingsPanel({ onClose }: { onClose: () => void }) {
  return <CollectionSettingsPanel collection="extensions" onClose={onClose} />;
}
