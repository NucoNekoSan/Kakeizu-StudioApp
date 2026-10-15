import { useState } from "react";
import { Shell } from "../../components/ui";
import { useSettingsDefinitions } from "./useSettingsDefinitions";
import { RelationshipSettings } from "./RelationshipSettings";
import { GenderSettings } from "./GenderSettings";

function SettingsPage() {
  const [tab, setTab] = useState<"relationships" | "genders">("relationships"),
    { relationships, genders } = useSettingsDefinitions();
  return (
    <Shell>
      <main className="page settings-page">
        <div className="page-head" data-tutorial-target="settings-heading">
          <div>
            <span className="eyebrow">CUSTOM DEFINITIONS</span>
            <h1>表示設定</h1>
            <p>相関図で使用する続柄と性別の見た目を管理します。</p>
          </div>
        </div>
        <div className="tabs" role="tablist">
          <button
            id="relationships-tab"
            role="tab"
            aria-selected={tab === "relationships"}
            aria-controls="settings-panel"
            className={tab === "relationships" ? "active" : ""}
            onClick={() => setTab("relationships")}
          >
            続柄 <span>{relationships.data?.length || 0}</span>
          </button>
          <button
            id="genders-tab"
            role="tab"
            aria-selected={tab === "genders"}
            aria-controls="settings-panel"
            className={tab === "genders" ? "active" : ""}
            onClick={() => setTab("genders")}
          >
            性別 <span>{genders.data?.length || 0}</span>
          </button>
        </div>
        <div id="settings-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
          {tab === "relationships" && (
            <RelationshipSettings
              data={relationships.data || []}
              loading={relationships.isLoading}
            />
          )}
          {tab === "genders" && (
            <GenderSettings
              data={genders.data || []}
              loading={genders.isLoading}
            />
          )}
        </div>
      </main>
    </Shell>
  );
}

export default SettingsPage;
