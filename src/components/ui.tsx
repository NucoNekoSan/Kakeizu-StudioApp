import { useEffect, useId, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { GitBranch, LayoutGrid, LogOut, Settings, X } from "lucide-react";
import { api } from "../api";
import TemporaryModeBanner from "../features/storage/TemporaryModeBanner";
import type { Shape } from "../types";

export function Logo() {
  return (
    <NavLink className="brand" to="/charts">
      <span className="brand-mark">
        <GitBranch size={20} aria-hidden="true" />
      </span>
      <span>
        <b>Kakeizu</b>
        <small>STUDIO</small>
      </span>
    </NavLink>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <nav aria-label="メインナビゲーション">
          <NavLink to="/charts">
            <LayoutGrid size={17} aria-hidden="true" />
            相関図
          </NavLink>
          <NavLink to="/settings">
            <Settings size={17} aria-hidden="true" />
            設定
          </NavLink>
          <button
            className="nav-button"
            onClick={async () => {
              await api.logout();
              navigate("/login");
            }}
          >
            <LogOut size={17} aria-hidden="true" />
            ログアウト
          </button>
        </nav>
      </header>
      <TemporaryModeBanner />
      {children}
    </div>
  );
}
export function Spinner({ label = "読み込み中" }: { label?: string }) {
  return (
    <div className="center-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function ShapeMark({
  shape,
  color,
  textColor = "#fff",
  label,
}: {
  shape: Shape;
  color: string;
  textColor?: string;
  label?: string;
}) {
  return (
    <span
      className={`shape-mark ${shape}`}
      style={{ backgroundColor: color, color: textColor }}
      aria-hidden="true"
    >
      {label?.slice(0, 1)}
    </span>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: React.ReactNode;
}) {
  const modalRef = useRef<HTMLElement>(null),
    titleId = useId(),
    returnFocusRef = useRef<HTMLElement | null>(null),
    onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    if (!modal) return;
    const getFocusable = () =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
    (getFocusable()[0] || modal).focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = getFocusable();
      if (!elements.length) return;
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="閉じる">
            <X aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
