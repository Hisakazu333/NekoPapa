import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = "", ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

interface PageHeadingProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeading({ eyebrow, title, description, actions }: PageHeadingProps) {
  return (
    <header className="page-heading">
      <div className="page-heading__copy">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-heading__actions">{actions}</div> : null}
    </header>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "toggle--checked" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__thumb" />
    </button>
  );
}

interface SettingRowProps {
  icon: ReactNode;
  title: string;
  description?: string;
  control?: ReactNode;
  onClick?: () => void;
}

export function SettingRow({ icon, title, description, control, onClick }: SettingRowProps) {
  const content = (
    <>
      <span className="setting-row__icon">{icon}</span>
      <span className="setting-row__copy">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <span className="setting-row__control">
        {control ?? <ChevronRight size={16} aria-hidden="true" />}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="setting-row setting-row--button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="setting-row">{content}</div>;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  detail: string;
}

export function EmptyState({ icon, title, detail }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{icon}</span>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}
