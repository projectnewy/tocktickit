import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: ReactNode;
}

// One component, one error convention: label above the control, required
// fields carry a red asterisk (which never replaces the message), and the
// error renders immediately below the field — never as a single message at
// the top of the form. A single control child is wired to its message with
// aria-describedby/aria-invalid so assistive tech announces the problem.
export function FormField({ id, label, required, error, help, children }: FormFieldProps) {
  const messageId = error ? `${id}-error` : help ? `${id}-help` : undefined;

  let control = children;
  if (isValidElement(children) && messageId) {
    const element = children as ReactElement<Record<string, unknown>>;
    const existing = element.props["aria-describedby"] as string | undefined;
    control = cloneElement(element, {
      "aria-describedby": existing ? `${existing} ${messageId}` : messageId,
      ...(error ? { "aria-invalid": true } : {}),
    });
  }

  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label fw-semibold">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {control}
      {help && !error && (
        <div className="tk-help" id={`${id}-help`}>
          {help}
        </div>
      )}
      {error && (
        <div className="tk-field-error" id={`${id}-error`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
