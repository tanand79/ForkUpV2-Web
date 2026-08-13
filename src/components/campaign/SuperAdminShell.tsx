/**
 * SuperAdminShell — sidebar + content layout for Platform Console.
 *
 * Purpose: group Super Admin screens into Overview / Organizations /
 * Fundraising / Users & Reviews / Finance / Settings (v1-style console).
 *
 * Inputs: active tab, onChange tab, header actions, children (main content).
 * Outputs: sidebar nav + optional section sub-tabs above content.
 */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  HeartHandshake,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

export type SuperAdminTabId =
  | "overview"
  | "verification"
  | "forkup-review"
  | "users"
  | "nonprofits"
  | "businesses"
  | "campaigns"
  | "fundraisers"
  | "donations"
  | "profile"
  | "ai"
  | "charges"
  | "smtp";

type NavItem = { id: SuperAdminTabId; label: string };

type NavSection =
  | { kind: "link"; id: SuperAdminTabId; label: string; icon: ReactNode }
  | {
      kind: "group";
      key: string;
      label: string;
      icon: ReactNode;
      items: NavItem[];
    };

const NAV: NavSection[] = [
  {
    kind: "link",
    id: "overview",
    label: "Overview",
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    kind: "group",
    key: "organizations",
    label: "Organizations",
    icon: <Building2 className="size-4" />,
    items: [
      { id: "nonprofits", label: "Nonprofits" },
      { id: "businesses", label: "Businesses" },
    ],
  },
  {
    kind: "group",
    key: "fundraising",
    label: "Fundraising",
    icon: <HeartHandshake className="size-4" />,
    items: [
      { id: "campaigns", label: "Campaigns" },
      { id: "fundraisers", label: "Fundraisers" },
      { id: "donations", label: "Donations" },
    ],
  },
  {
    kind: "group",
    key: "users-reviews",
    label: "Users & Reviews",
    icon: <Users className="size-4" />,
    items: [
      { id: "users", label: "Users" },
      { id: "verification", label: "Verification" },
      { id: "forkup-review", label: "ForkUp Review" },
    ],
  },
  {
    kind: "group",
    key: "finance",
    label: "Finance",
    icon: <Wallet className="size-4" />,
    items: [{ id: "charges", label: "Charges" }],
  },
  {
    kind: "group",
    key: "settings",
    label: "Settings",
    icon: <Settings className="size-4" />,
    items: [
      { id: "profile", label: "Profile" },
      { id: "ai", label: "AI Engine" },
      { id: "smtp", label: "SMTP" },
    ],
  },
];

function sectionForTab(tab: SuperAdminTabId): NavSection | null {
  for (const s of NAV) {
    if (s.kind === "link" && s.id === tab) return s;
    if (s.kind === "group" && s.items.some((i) => i.id === tab)) return s;
  }
  return null;
}

type Props = {
  tab: SuperAdminTabId;
  onTabChange: (tab: SuperAdminTabId) => void;
  signedInAs: string;
  onHome: () => void;
  onSignOut: () => void;
  children: ReactNode;
};

export function SuperAdminShell({
  tab,
  onTabChange,
  signedInAs,
  onHome,
  onSignOut,
  children,
}: Props) {
  const activeSection = sectionForTab(tab);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of NAV) {
      if (s.kind === "group") {
        init[s.key] = s.items.some((i) => i.id === tab);
      }
    }
    // Default: expand fundraising + users when landing on overview
    if (tab === "overview") {
      init.organizations = true;
      init.fundraising = true;
    }
    return init;
  });

  useEffect(() => {
    const sec = sectionForTab(tab);
    if (sec?.kind === "group") {
      setOpenGroups((prev) => ({ ...prev, [sec.key]: true }));
    }
  }, [tab]);

  const subItems = useMemo(() => {
    if (activeSection?.kind === "group") return activeSection.items;
    return [];
  }, [activeSection]);

  const sectionTitle =
    activeSection?.kind === "group"
      ? activeSection.label
      : activeSection?.kind === "link"
        ? activeSection.label
        : "Console";

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-0 lg:flex-row lg:min-h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="border-b border-border bg-card lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="px-5 py-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-800">
              <Shield className="size-3" /> Super Admin
            </span>
            <h1 className="mt-3 font-display text-xl font-bold tracking-tight">
              Platform console
            </h1>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Signed in as {signedInAs}
            </p>
          </div>

          <nav className="px-3 pb-4">
            <ul className="space-y-0.5">
              {NAV.map((section) => {
                if (section.kind === "link") {
                  const active = tab === section.id;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => onTabChange(section.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-secondary"
                        }`}
                      >
                        {section.icon}
                        {section.label}
                      </button>
                    </li>
                  );
                }

                const open = openGroups[section.key] ?? false;
                const groupActive = section.items.some((i) => i.id === tab);
                return (
                  <li key={section.key} className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        toggleGroup(section.key);
                        if (!open && section.items[0]) {
                          onTabChange(section.items[0].id);
                        }
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                        groupActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {section.icon}
                      <span className="flex-1 text-left">{section.label}</span>
                      {open ? (
                        <ChevronDown className="size-4 opacity-70" />
                      ) : (
                        <ChevronRight className="size-4 opacity-70" />
                      )}
                    </button>
                    {open && (
                      <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                        {section.items.map((item) => {
                          const active = tab === item.id;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => onTabChange(item.id)}
                                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                  active
                                    ? "bg-primary/10 font-semibold text-primary"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                }`}
                              >
                                {item.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-border pt-3">
              <div className="flex flex-col gap-1 px-1">
                <button
                  type="button"
                  onClick={onHome}
                  className="rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Sign out
                </button>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main */}
        <section className="min-w-0 flex-1 px-5 py-6 sm:px-8">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {sectionTitle}
            </p>
            {subItems.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1 border-b border-border pb-0">
                {subItems.map((item) => {
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>{children}</div>
        </section>
      </div>
    </div>
  );
}
