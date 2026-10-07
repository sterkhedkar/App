import { useState, type ReactNode } from 'react';

/**
 * A button that asks for confirmation inline instead of using window.confirm,
 * which is blocked in some embedded viewers.
 */
export function ConfirmButton({
  className,
  question,
  confirmLabel = 'Yes',
  onConfirm,
  disabled,
  title,
  children,
}: {
  className?: string;
  question: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} disabled={disabled} title={title} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirm-inline" role="group" aria-label={question}>
      <span>{question}</span>
      <button
        type="button"
        className="link danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="link" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
