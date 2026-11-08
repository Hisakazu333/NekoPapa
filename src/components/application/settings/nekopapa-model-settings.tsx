import { CollectionSettingsPanel } from "./nekopapa-collection-settings";

export function ModelSettingsPanel({ onClose }: { onClose: () => void }) {
  return <CollectionSettingsPanel collection="models" onClose={onClose} />;
}
