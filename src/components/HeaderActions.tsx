import type { RefObject } from "react";
import { BookOpenCheck, CircleHelp, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import BackupImportControl from "../features/backup/BackupImportControl";

export function GuidanceActions({
  onStartTutorial,
  tutorialButtonRef,
  showContact = false,
}: {
  onStartTutorial?: () => void;
  tutorialButtonRef?: RefObject<HTMLButtonElement | null>;
  showContact?: boolean;
}) {
  return (
    <div className="header-guidance" data-tutorial-target="resources">
      {onStartTutorial && (
        <button
          ref={tutorialButtonRef}
          type="button"
          className="button header-action"
          onClick={onStartTutorial}
          aria-label="チュートリアルを開始"
          data-tooltip="チュートリアルを開始"
        >
          <BookOpenCheck size={17} aria-hidden="true" />
          <span className="button-label">チュートリアル</span>
        </button>
      )}
      <Link
        className="button header-action"
        to="/help"
        aria-label="ヘルプ"
        data-tooltip="ヘルプを開く"
      >
        <CircleHelp size={17} aria-hidden="true" />
        <span className="button-label">ヘルプ</span>
      </Link>
      {showContact && <ContactAction />}
    </div>
  );
}

function ContactAction() {
  return (
    <a
      className="button header-action"
      href="https://nuconeko-garden.com/contact/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="コンタクト（新しいタブで開く）"
      data-tooltip="コンタクト"
    >
      <Mail size={17} aria-hidden="true" />
      <span className="button-label">コンタクト</span>
    </a>
  );
}

export function ResourceActions({
  showContact = true,
}: {
  showContact?: boolean;
}) {
  return (
    <div className="header-resources">
      <BackupImportControl />
      {showContact && <ContactAction />}
    </div>
  );
}
