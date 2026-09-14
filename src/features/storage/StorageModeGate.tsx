import { useState } from "react";
import { Laptop, ShieldOff } from "lucide-react";
import { Logo } from "../../components/ui";
import { resetStoreCache } from "../../storage/localApi";
import {
  readStorageMode,
  writeStorageMode,
  type StorageMode,
} from "../../storage/storageMode";

/**
 * 起動時の保存先の選択。
 *
 * このアプリにはログインが無く、共有 PC では前の利用者のデータが
 * そのまま残る。最初に保存先を選ばせることで、残したくない場面を
 * 利用者が明示的に選べるようにしている。
 */
export default function StorageModeGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<StorageMode | null>(() => readStorageMode());

  if (mode) return <>{children}</>;

  const choose = (selected: StorageMode) => {
    writeStorageMode(selected);
    resetStoreCache();
    setMode(selected);
  };

  return (
    <div className="welcome">
      <div className="welcome-card">
        <Logo />
        <h1>この端末での保存方法を選んでください</h1>
        <p className="welcome-lead">
          作成した相関図は、この端末のブラウザ内にのみ保存されます。サーバーへ送信されることはありません。
        </p>

        <button
          type="button"
          className="welcome-option"
          onClick={() => choose("persistent")}
        >
          <Laptop size={22} aria-hidden="true" />
          <span>
            <strong>この端末に保存する</strong>
            <small>
              自分専用の端末向け。次に開いたときも続きから作業できます。
            </small>
          </span>
        </button>

        <button
          type="button"
          className="welcome-option"
          onClick={() => choose("session")}
        >
          <ShieldOff size={22} aria-hidden="true" />
          <span>
            <strong>今回だけ使う</strong>
            <small>
              共有の端末向け。端末には一切保存しません。タブを閉じるか再読み込みすると消えるため、必要な内容はその都度書き出して保管してください。
            </small>
          </span>
        </button>

        <p className="welcome-note">
          この選択はあとから設定画面で変更できます。
        </p>
      </div>
    </div>
  );
}
