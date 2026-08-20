import type { ReactNode } from "react";

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
// the top of the form.
export function FormField({ id, label, required, error, help, children }: FormFieldProps) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label fw-semibold">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {help && !error && <div className="tk-help">{help}</div>}
      {error && (
        <div className="tk-field-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
