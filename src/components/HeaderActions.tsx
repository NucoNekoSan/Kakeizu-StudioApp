import type { RefObject } from "react";
import { BookOpenCheck, CircleHelp, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import BackupImportControl from "../features/backup/BackupImportControl";

export function GuidanceActions({
  onStartTutorial,
  tutorialButtonRef,
}: {
  onStartTutorial?: () => void;
  tutorialButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="header-guidance" data-tutorial-target="resources">
      {onStartTutorial && (
        <button
          ref={tutorialButtonRef}
          type="button"
          className="button header-action"
          onClick={onStartTutorial}
        >
          <BookOpenCheck size={17} aria-hidden="true" />
          <span className="button-label">チュートリアル</span>
        </button>
      )}
      <Link className="button header-action" to="/help">
        <CircleHelp size={17} aria-hidden="true" />
        <span className="button-label">ヘルプ</span>
      </Link>
    </div>
  );
}

export function ResourceActions() {
  return (
    <div className="header-resources">
      <BackupImportControl />
      <a
        className="button header-action"
        href="https://nuconeko-garden.com/contact/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle size={17} aria-hidden="true" />
        <span className="button-label">コンタクト</span>
      </a>
    </div>
  );
}
