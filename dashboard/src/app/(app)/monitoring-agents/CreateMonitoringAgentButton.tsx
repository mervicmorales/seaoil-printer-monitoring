"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, KeyRound, Plus, ServerCog, X } from "lucide";
import SearchableDropdown from "@/components/SearchableDropdown";
import { IconGlyph } from "@/components/ui";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export type MonitoringAgentOfficeOption = {
  id: number;
  name: string;
};

type GeneratedCredentials = {
  agentId: number;
  agentKey: string;
  token: string;
  agentName: string;
  officeName: string;
};

export default function CreateMonitoringAgentButton({
  offices,
  onCreated,
}: {
  offices: MonitoringAgentOfficeOption[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [officeId, setOfficeId] = useState("");
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<"key" | "token" | "config" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  useBodyScrollLock(open);

  const officeOptions = useMemo(() => offices.map((office) => ({
    value: String(office.id),
    label: office.name,
  })), [offices]);

  const reset = useCallback(() => {
    setOfficeId("");
    setCredentials(null);
    setGenerating(false);
    setSaved(false);
    setCopied(null);
    setError(null);
  }, []);

  const closeDialog = useCallback(() => {
    if (generating || (credentials && !saved)) return;
    setOpen(false);
    reset();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [credentials, generating, reset, saved]);

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, open]);

  async function generateCredentials() {
    if (!officeId) {
      setError("Select an office before generating credentials.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/monitoring/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ officeId: Number(officeId) }),
      });
      const body = await response.json() as {
        success?: boolean;
        message?: string;
        credentials?: GeneratedCredentials;
      };
      if (!response.ok || !body.success || !body.credentials) {
        throw new Error(body.message || "Unable to generate agent credentials");
      }
      setCredentials(body.credentials);
      onCreated();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate agent credentials");
    } finally {
      setGenerating(false);
    }
  }

  async function copyValue(kind: "key" | "token" | "config", value: string) {
    try {
      await writeClipboard(value);
      setCopied(kind);
      setError(null);
    } catch {
      setError("Your browser blocked clipboard access. Select and copy the value manually.");
    }
  }

  const configuration = credentials ? [
    `SEAOIL_API_URL=${typeof window === "undefined" ? "" : window.location.origin}/api/monitoring/ingest`,
    `SEAOIL_CONFIG_URL=${typeof window === "undefined" ? "" : window.location.origin}/api/monitoring/config`,
    `SEAOIL_AGENT_KEY=${credentials.agentKey}`,
    `SEAOIL_AGENT_TOKEN=${credentials.token}`,
    `SEAOIL_AGENT_NAME=${credentials.agentName}`,
    `SEAOIL_AGENT_LOCATION=${credentials.officeName}`,
  ].join("\n") : "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#014171] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#00365f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#014171]"
      >
        <IconGlyph icon={Plus} size={14} />
        Add agent
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.3)]"
          >
            <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                <IconGlyph icon={ServerCog} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-lg font-bold text-[#014171]">
                  {credentials ? "Save agent credentials" : "Add monitoring agent"}
                </h2>
                <p id={descriptionId} className="mt-0.5 text-sm leading-5 text-slate-500">
                  {credentials ? "These credentials are displayed once and cannot be retrieved later." : "Select the office where this agent will be installed."}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeDialog}
                disabled={generating || Boolean(credentials && !saved)}
                aria-label="Close add monitoring agent dialog"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <IconGlyph icon={X} size={17} />
              </button>
            </div>

            {!credentials ? (
              <div className="space-y-5 p-5">
                <SearchableDropdown
                  label="Office"
                  value={officeId}
                  onValueChange={(value) => {
                    setOfficeId(value);
                    setError(null);
                  }}
                  required
                  placeholder="Search offices..."
                  options={officeOptions}
                />
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  The agent will appear as <strong>Awaiting Installation</strong>. Runtime details are added automatically after its first authenticated connection.
                </div>
                {error && <ErrorMessage message={error} />}
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={closeDialog} disabled={generating} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Cancel</button>
                  <button type="button" onClick={() => void generateCredentials()} disabled={generating || !officeId} className="inline-flex items-center gap-2 rounded-lg bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00365f] disabled:cursor-not-allowed disabled:opacity-55">
                    <IconGlyph icon={KeyRound} size={15} />
                    {generating ? "Generating…" : "Generate credentials"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  Copy both values now. Only the token hash is stored in the database, so the token cannot be displayed again.
                </div>
                <CredentialField label="SEAOIL_AGENT_KEY" value={credentials.agentKey} copied={copied === "key"} onCopy={() => void copyValue("key", credentials.agentKey)} />
                <CredentialField label="SEAOIL_AGENT_TOKEN" value={credentials.token} copied={copied === "token"} onCopy={() => void copyValue("token", credentials.token)} secret />
                <button type="button" onClick={() => void copyValue("config", configuration)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#014171]/25 bg-sky-50 px-4 py-2.5 text-sm font-bold text-[#014171] transition hover:bg-sky-100">
                  <IconGlyph icon={copied === "config" ? Check : Copy} size={15} />
                  {copied === "config" ? "Configuration copied" : "Copy agent configuration"}
                </button>
                {error && <ErrorMessage message={error} />}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-5 text-slate-700">
                  <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} className="mt-0.5 size-4 accent-[#014171]" />
                  <span>I have copied and securely saved the agent key and token.</span>
                </label>
                <button type="button" onClick={closeDialog} disabled={!saved} className="w-full rounded-lg bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00365f] disabled:cursor-not-allowed disabled:opacity-45">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function CredentialField({
  label,
  value,
  copied,
  onCopy,
  secret = false,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  secret?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 p-2 pl-3">
        <code className={`min-w-0 flex-1 break-all text-sm font-semibold ${secret ? "text-rose-700" : "text-slate-800"}`}>{value}</code>
        <button type="button" onClick={onCopy} aria-label={`Copy ${label}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#014171] shadow-sm ring-1 ring-slate-200 transition hover:bg-sky-50">
          <IconGlyph icon={copied ? Check : Copy} size={15} />
        </button>
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-700">{message}</p>;
}

async function writeClipboard(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  if (!copied) throw new Error("Clipboard access was denied");
}
