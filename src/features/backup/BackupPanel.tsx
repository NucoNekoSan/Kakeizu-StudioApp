import DangerZone from "../storage/DangerZone";
import StorageModeSection from "../storage/StorageModeSection";

export default function BackupPanel() {
  return (
    <section className="backup-panel">
      <StorageModeSection />
      <DangerZone />
    </section>
  );
}
