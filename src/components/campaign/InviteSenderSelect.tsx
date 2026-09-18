/**
 * From Name / Sender dropdown for invite and lifecycle emails.
 *
 * Purpose: Let the user pick which org member (or signed-in self) appears as
 * the email From display name. SMTP From address stays platform smtp_from.
 *
 * Inputs: org type/id (or self mode), controlled value, onChange.
 * Outputs: native select; loads members from GET /api/profiles/organization-members.
 */
"use client";

import { useEffect, useState } from "react";
import {
  fetchCurrentUser,
  fetchOrganizationMembers,
  type OrganizationMemberPerson,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth-storage";
import { loadUserSession } from "@/lib/auth-session";

type OrgModeProps = {
  mode?: "org";
  organizationType: "nonprofit" | "business";
  organizationId: number | null | undefined;
  value: number | null;
  onChange: (userId: number | null) => void;
  className?: string;
  label?: string;
  /** When true, auto-select the signed-in user once members load (if in list). */
  preferCurrentUser?: boolean;
};

type SelfModeProps = {
  mode: "self";
  value: number | null;
  onChange: (userId: number | null) => void;
  className?: string;
  label?: string;
};

type Props = OrgModeProps | SelfModeProps;

const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";

export function InviteSenderSelect(props: Props) {
  const label = props.label ?? "From";
  const [members, setMembers] = useState<OrganizationMemberPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = props.mode === "self";
  const orgType = !isSelf ? props.organizationType : null;
  const orgId = !isSelf ? props.organizationId : null;
  const preferCurrentUser = !isSelf ? props.preferCurrentUser !== false : true;

  useEffect(() => {
    if (isSelf) {
      if (!getAuthToken()) {
        setMembers([]);
        return;
      }
      let cancelled = false;
      setLoading(true);
      void fetchCurrentUser()
        .then((user) => {
          if (cancelled) return;
          const name =
            user.fullName?.trim() ||
            user.email.split("@")[0] ||
            "You";
          setMembers([
            {
              userId: user.id,
              fullName: name,
              email: user.email,
              role: "owner",
            },
          ]);
          if (props.value == null && preferCurrentUser) {
            props.onChange(user.id);
          }
        })
        .catch(() => {
          if (cancelled) return;
          const session = loadUserSession();
          if (!session?.userId) {
            setMembers([]);
            return;
          }
          setMembers([
            {
              userId: session.userId,
              fullName: session.email.split("@")[0] || "You",
              email: session.email,
              role: "owner",
            },
          ]);
          if (props.value == null && preferCurrentUser) {
            props.onChange(session.userId);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!orgId || orgId <= 0 || !getAuthToken()) {
      setMembers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchOrganizationMembers({
      organizationType: orgType!,
      organizationId: orgId,
    })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.members) ? res.members : [];
        setMembers(list);
        if (list.length === 0) return;
        const session = loadUserSession();
        const currentId = session?.userId ?? null;
        const stillValid =
          props.value != null && list.some((m) => m.userId === props.value);
        if (stillValid) return;
        const preferred =
          (preferCurrentUser &&
            currentId != null &&
            list.find((m) => m.userId === currentId)) ||
          list[0];
        props.onChange(preferred.userId);
      })
      .catch((err) => {
        if (cancelled) return;
        setMembers([]);
        setError(err instanceof Error ? err.message : "Could not load senders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally depend on org identity only — not onChange/value every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelf, orgType, orgId]);

  if (!getAuthToken()) return null;
  if (!isSelf && (!orgId || orgId <= 0)) return null;
  if (!loading && members.length === 0 && !error) return null;

  return (
    <div className={props.className ?? "space-y-2"}>
      <label className="block text-sm font-semibold">
        {label}
        <span className="ml-1 font-normal text-muted-foreground">
          (shown on the email)
        </span>
      </label>
      <select
        className={fieldClass}
        disabled={loading || members.length === 0}
        value={props.value ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          props.onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
      >
        {loading ? (
          <option value="">Loading…</option>
        ) : (
          members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName}
            </option>
          ))
        )}
      </select>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Recipients see this name as From. Replies go to that person&apos;s email.
        </p>
      )}
    </div>
  );
}
