import { UNIVERSAL_FEATURES, type PlatformPackDefinition } from "@mag/shared";

interface PlatformPackPanelProps {
  pack: PlatformPackDefinition;
}

const supportLabels: Record<string, string> = {
  full: "full",
  partial: "partial",
  reserved: "reserved"
};

export function PlatformPackPanel({ pack }: PlatformPackPanelProps) {
  return (
    <div className="card platform-pack-card">
      <div className="card-row">
        <div>
          <span className="section-kicker">Platform pack</span>
          <h3>{pack.label}</h3>
        </div>
        <span className="status-pill accent-pill">v2</span>
      </div>
      <p>{pack.architectureBaseline}</p>
      <div className="platform-pack-grid">
        <div>
          <span>State</span>
          <strong>{pack.stateManagement}</strong>
        </div>
        <div>
          <span>Navigation</span>
          <strong>{pack.navigation}</strong>
        </div>
        <div>
          <span>Testing</span>
          <strong>{pack.testing}</strong>
        </div>
      </div>
      <div className="feature-matrix">
        {UNIVERSAL_FEATURES.map((featureId) => (
          <span className={`feature-support support-${pack.featureMatrix[featureId]}`} key={featureId}>
            {featureId}: {supportLabels[pack.featureMatrix[featureId]]}
          </span>
        ))}
      </div>
    </div>
  );
}
