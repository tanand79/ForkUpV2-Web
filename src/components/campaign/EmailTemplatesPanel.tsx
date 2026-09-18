/**
 * Email template library + compose/send (role dashboards).
 *
 * Purpose: Compact page trigger opens a modal with template edit / From name /
 * preview / send. SMTP From address stays platform.
 *
 * Inputs: scopeType + scopeId (+ optional campaignId for campaign override).
 * Outputs: trigger card + dialog; calls /api/email-templates/*.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Mail, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteEmailTemplate,
  fetchEmailTemplates,
  previewEmailTemplate,
  saveEmailTemplate,
  sendEmailFromTemplate,
  type EmailTemplateRecord,
  type EmailTemplateScopeType,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth-storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

type Props = {
  scopeType: EmailTemplateScopeType;
  scopeId: number;
  /** When set, edits/saves apply as campaign override. */
  campaignId?: number | null;
  title?: string;
  description?: string;
  className?: string;
};

export function EmailTemplatesPanel({
  scopeType,
  scopeId,
  campaignId = null,
  title = "Email templates",
  description = "Edit message content, From name, preview, and send.",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [name, setName] = useState("");
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [to, setTo] = useState("");
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "send" | "preview" | "delete" | null>(null);

  const refresh = useCallback(async () => {
    if (!scopeId || !getAuthToken()) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEmailTemplates({
        scopeType,
        scopeId,
        campaignId,
      });
      setTemplates(res.templates);
      setPlaceholders(res.placeholders ?? []);
      const first = res.templates[0];
      if (first) {
        setSelectedKey(first.templateKey);
        setName(first.name);
        setFromName(first.defaultFromName ?? "");
        setSubject(first.subject);
        setBody(first.body);
        setTemplateId(first.id);
        setCanEdit(first.canEdit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [scopeType, scopeId, campaignId]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const selectTemplate = (key: string) => {
    const t = templates.find((x) => x.templateKey === key);
    if (!t) return;
    setSelectedKey(key);
    setName(t.name);
    setFromName(t.defaultFromName ?? "");
    setSubject(t.subject);
    setBody(t.body);
    setTemplateId(t.id);
    setCanEdit(t.canEdit);
    setPreviewSubject(null);
    setPreviewBody(null);
  };

  const onSave = async () => {
    if (!canEdit) return;
    setBusy("save");
    try {
      const res = await saveEmailTemplate({
        scopeType,
        scopeId,
        campaignId,
        templateKey: selectedKey || "custom",
        name: name.trim() || selectedKey,
        subject,
        body,
        defaultSenderUserId: null,
        defaultFromName: fromName.trim() || null,
      });
      toast.success("Template saved");
      setTemplateId(res.template.id);
      await refresh();
      setSelectedKey(res.template.templateKey);
      setName(res.template.name);
      setFromName(res.template.defaultFromName ?? "");
      setSubject(res.template.subject);
      setBody(res.template.body);
      setCanEdit(res.template.canEdit);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(null);
    }
  };

  const onRevert = async () => {
    if (!templateId || !canEdit) return;
    setBusy("delete");
    try {
      await deleteEmailTemplate(templateId);
      toast.success("Reverted to system default");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revert");
    } finally {
      setBusy(null);
    }
  };

  const onPreview = async () => {
    setBusy("preview");
    try {
      const res = await previewEmailTemplate({
        scopeType,
        scopeId,
        campaignId,
        templateKey: selectedKey,
        subject,
        body,
      });
      setPreviewSubject(res.subject);
      setPreviewBody(res.body);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  };

  const onSend = async () => {
    if (!canEdit) return;
    if (!to.includes("@")) {
      toast.error("Enter a valid recipient email");
      return;
    }
    setBusy("send");
    try {
      const res = await sendEmailFromTemplate({
        scopeType,
        scopeId,
        campaignId,
        templateKey: selectedKey || "custom",
        to: to.trim(),
        subject,
        body,
        fromName: fromName.trim() || null,
        saveAsTemplate: false,
      });
      if (res.success || res.status === "sent") {
        toast.success("Email sent");
      } else if (res.status === "skipped") {
        toast.info(res.errorMessage || "Email skipped (provider / config)");
      } else {
        toast.error(res.errorMessage || "Send failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(null);
    }
  };

  if (!getAuthToken() || !scopeId) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 sm:p-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold">{title}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {description}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {campaignId ? (
            <p className="text-xs text-muted-foreground">
              Saving here overrides the org default for this campaign only.
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Template</span>
                <select
                  className={field}
                  value={selectedKey}
                  onChange={(e) => selectTemplate(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.templateKey} value={t.templateKey}>
                      {t.name}
                      {t.source === "database" ? " (edited)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">From name</span>
                <input
                  className={field}
                  value={fromName}
                  disabled={!canEdit}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Name shown as From on the email"
                  maxLength={255}
                />
                <span className="text-xs text-muted-foreground">
                  Name only — the sending address stays ForkUp. Click Save template
                  to keep this name. Leave blank to use the organization default
                  name.
                </span>
              </label>

              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Reply-To name</p>
                <p className={`${field} text-muted-foreground`}>
                  {fromName.trim() || "Same as organization default"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Always matches From name. Replies use the organization contact
                  email.
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Template name</span>
                <input
                  className={field}
                  value={name}
                  disabled={!canEdit}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Label in the template list"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Subject</span>
                <input
                  className={field}
                  value={subject}
                  disabled={!canEdit}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Body</span>
                <textarea
                  className={`${field} min-h-[180px] resize-y`}
                  value={body}
                  disabled={!canEdit}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>

              {placeholders.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Placeholders:{" "}
                  {placeholders.map((p) => `{{${p}}}`).join(", ")}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canEdit || busy !== null}
                  onClick={() => void onSave()}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy === "save" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Save template
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onPreview()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {busy === "preview" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Preview
                </button>
                {templateId ? (
                  <button
                    type="button"
                    disabled={!canEdit || busy !== null}
                    onClick={() => void onRevert()}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-destructive disabled:opacity-50"
                  >
                    {busy === "delete" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Revert to default
                  </button>
                ) : null}
              </div>

              {!canEdit ? (
                <p className="text-xs text-muted-foreground">
                  View-only — ask an owner or admin to edit templates.
                </p>
              ) : null}

              {previewSubject != null && previewBody != null ? (
                <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview
                  </p>
                  <p className="mt-2 text-sm font-semibold">{previewSubject}</p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                    {previewBody}
                  </pre>
                </div>
              ) : null}

              <div className="border-t border-border pt-4">
                <p className="text-sm font-semibold">Send now</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    className={field}
                    placeholder="recipient@example.com"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    disabled={!canEdit}
                  />
                  <button
                    type="button"
                    disabled={!canEdit || busy !== null}
                    onClick={() => void onSend()}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy === "send" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
