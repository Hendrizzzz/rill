import {
  useEffect,
  useId,
  useRef,
  useState,
  type SubmitEvent,
} from "react";

import { ApiError, downloadAccountExport } from "../../api/client";
import { useAuth } from "./auth-context";

interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "The account service is not reachable. Your typing test still works.";
}

function stringField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

interface PasswordFieldProps {
  autoComplete: "current-password" | "new-password";
  disabled: boolean;
  label: string;
  minLength?: number;
}

function PasswordField({
  autoComplete,
  disabled,
  label,
  minLength,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          disabled={disabled}
        />
        <button
          type="button"
          className="password-toggle"
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
        >
          {visible ? "hide" : "show"}
        </button>
      </div>
    </div>
  );
}

export function AccountDialog({ open, onClose }: AccountDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const finishClose = () => {
    formRef.current?.reset();
    setMode("login");
    setError("");
    setDeleting(false);
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const submitCredentials = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const username = stringField(data, "username");
    const password = stringField(data, "password");
    try {
      if (mode === "login") {
        await auth.signIn(username, password);
      } else {
        await auth.register(username, password);
      }
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitDeletion = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await auth.deleteAccount(stringField(data, "password"));
      dialogRef.current?.close();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="account-dialog"
      aria-labelledby="account-title"
      onClose={finishClose}
      onCancel={() => {
        setError("");
        setDeleting(false);
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">private workspace</p>
          <h2 id="account-title">
            {auth.user === null ? "Account" : auth.user.username}
          </h2>
        </div>
        <button
          type="button"
          className="quiet-button"
          onClick={() => dialogRef.current?.close()}
        >
          close <span aria-hidden="true">×</span>
        </button>
      </div>

      {auth.status === "loading" ? (
        <p className="dialog-status" role="status">
          Checking this browser…
        </p>
      ) : auth.status === "offline" ? (
        <div className="dialog-status">
          <p>The account service is unavailable. Guest tests remain local.</p>
          <button type="button" onClick={() => void auth.retry()}>
            try again
          </button>
        </div>
      ) : auth.user === null ? (
        <>
          <div className="account-mode" aria-label="Account action">
            <button
              type="button"
              aria-pressed={mode === "login"}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === "register"}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              create account
            </button>
          </div>
          <form
            ref={formRef}
            className="account-form"
            onSubmit={(event) => void submitCredentials(event)}
          >
            <label>
              username
              <input
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                required
                disabled={busy}
              />
            </label>
            <PasswordField
              key={`${mode}-${open ? "open" : "closed"}`}
              label="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={12}
              disabled={busy}
            />
            {mode === "register" ? (
              <p className="field-note">
                12 or more characters. Usernames use letters, numbers, and underscores.
              </p>
            ) : null}
            {error === "" ? null : (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="primary-action" disabled={busy}>
              {busy ? "working…" : mode === "login" ? "sign in" : "create account"}
            </button>
          </form>
        </>
      ) : deleting ? (
        <form
          ref={formRef}
          className="account-form"
          onSubmit={(event) => void submitDeletion(event)}
        >
          <p>
            This permanently removes the account and its saved results. Local guest
            history is not affected.
          </p>
          <PasswordField
            key={`delete-${open ? "open" : "closed"}`}
            label="confirm password"
            autoComplete="current-password"
            disabled={busy}
          />
          {error === "" ? null : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              onClick={() => {
                setDeleting(false);
                setError("");
              }}
              disabled={busy}
            >
              keep account
            </button>
            <button type="submit" className="danger-action" disabled={busy}>
              {busy ? "deleting…" : "delete account"}
            </button>
          </div>
        </form>
      ) : (
        <div className="account-signed-in">
          <p>
            Results are saved privately to this account. Guest runs are never attached
            automatically.
          </p>
          {error === "" ? null : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="account-links">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                void downloadAccountExport()
                  .then(({ blob, filename }) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = filename;
                    link.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch((caught: unknown) => setError(messageFor(caught)))
                  .finally(() => setBusy(false));
              }}
            >
              export data
            </button>
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                setError("");
                void auth
                  .signOut()
                  .then(() => dialogRef.current?.close())
                  .catch((caught: unknown) => setError(messageFor(caught)))
                  .finally(() => setBusy(false));
              }}
              disabled={busy}
            >
              sign out
            </button>
            <button type="button" onClick={() => setDeleting(true)} disabled={busy}>
              delete account
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
