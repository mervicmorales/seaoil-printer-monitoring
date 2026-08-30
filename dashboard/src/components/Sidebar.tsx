"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MorphIcon, type IconNode } from "morphicons/react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Droplets,
  FileText,
  LayoutDashboard,
  KeyRound,
  LogOut,
  Menu,
  Monitor,
  Radar,
  PanelLeftClose,
  Printer,
  Settings,
  Sun,
  Users,
  Wrench,
  X,
} from "lucide";
import LogoutConfirmationDialog from "@/components/LogoutConfirmationDialog";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import AuthBlob from "@/components/AuthBlob";
import { useBlobSkin } from "@/components/BlobSkinProvider";
import {
  BLOB_SKINS,
} from "@/lib/blob-skins";
import { MODULE_LABELS, type ModuleName } from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: IconNode;
  module?: ModuleName;
  separated?: boolean;
  children?: Array<{ href: string; label: string; icon: IconNode; adminOnly?: boolean; disabled?: boolean }>;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: MODULE_LABELS.dashboard, icon: LayoutDashboard, module: "dashboard" },
  { href: "/printers", label: MODULE_LABELS.printers, icon: Printer, module: "printers" },
  { href: "/toner-monitoring", label: MODULE_LABELS.toner, icon: Droplets, module: "toner" },
  { href: "/contracts", label: MODULE_LABELS.contract, icon: FileText, module: "contract" },
  { href: "/repair-history", label: MODULE_LABELS.repair, icon: Wrench, module: "repair" },
  {
    href: "/printdash",
    label: MODULE_LABELS.spot,
    icon: Monitor,
    separated: true,
    module: "spot",
    children: [
      { href: "/printdash", label: "Overview", icon: LayoutDashboard },
      { href: "/printdash/alerts", label: "Monitoring Alert", icon: Bell },
      { href: "/printdash/discover", label: "Discover Printers", icon: Radar, adminOnly: true },
    ],
  },
  {
    href: "/printops",
    label: MODULE_LABELS.printops,
    icon: Printer,
    separated: true,
    module: "printops",
    children: [
      { href: "/printops/print", label: "Print", icon: Printer },
      { href: "/printops/scan", label: "Scan", icon: Radar },
      { href: "/printops/jobs", label: "Print Jobs", icon: FileText },
    ],
  },
  { href: "/system", label: MODULE_LABELS.system, icon: Settings, separated: true, module: "system" },
  { href: "/manage", label: MODULE_LABELS.manage_users, icon: Users, module: "manage_users" },
  { href: "/manage/registrations", label: MODULE_LABELS.registrations, icon: KeyRound, module: "registrations" },
];

const EMPLOYEE_NAV: NavItem[] = [
  { href: "/portal", label: "Employee Portal", icon: LayoutDashboard },
  {
    href: "/portal#print-services",
    label: "Print Services",
    icon: Printer,
    separated: true,
    children: [
      { href: "#employee-print", label: "Print", icon: Printer, disabled: true },
      { href: "#employee-scan", label: "Scan", icon: Radar, disabled: true },
      { href: "#employee-print-jobs", label: "PrintJobs", icon: FileText, disabled: true },
    ],
  },
];

function StaticIcon({ icon, size = 19 }: { icon: IconNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon.map(([tag, attributes], index) =>
        createElement(tag, { ...attributes, key: `${tag}-${index}` }),
      )}
    </svg>
  );
}

export default function Sidebar({
  isAdmin,
  canManageSpot,
  logoUrl,
  accountName,
  initialCollapsed,
  moduleAccess,
  employeeMode = false,
}: {
  isAdmin: boolean;
  canManageSpot: boolean;
  logoUrl: string | null;
  accountName: string;
  initialCollapsed: boolean | null;
  moduleAccess: Record<ModuleName, boolean>;
  employeeMode?: boolean;
}) {
  const pathname = usePathname();
  const { blobSkin, setBlobSkin } = useBlobSkin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false);
  const [spotOpen, setSpotOpen] = useState(pathname.startsWith("/printdash"));
  const [printOpsOpen, setPrintOpsOpen] = useState(pathname.startsWith("/printops"));
  const [employeeServicesOpen, setEmployeeServicesOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [accountPosition, setAccountPosition] = useState({ top: 0, left: 0 });
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const signOutButtonRef = useRef<HTMLButtonElement>(null);
  const permittedItems = NAV.filter((item) => !item.module || moduleAccess[item.module]);
  const items = employeeMode ? EMPLOYEE_NAV : permittedItems;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.removeAttribute("data-theme");
    root.style.removeProperty("color-scheme");
    window.localStorage.removeItem("seaoil-theme");

    if (initialCollapsed === null) {
      let active = true;
      window.queueMicrotask(() => {
        if (!active) return;
        const savedCollapsed = window.localStorage.getItem("seaoil-sidebar-collapsed") === "true";
        setCollapsed(savedCollapsed);
        document.cookie = `seaoil-sidebar-collapsed=${savedCollapsed}; Path=/; Max-Age=31536000; SameSite=Lax`;
      });
      return () => {
        active = false;
      };
    }
  }, [initialCollapsed]);

  const updateAccountPosition = useCallback(() => {
    const rect = accountButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 256;
    const left = Math.max(12, Math.min(rect.right + 8, window.innerWidth - menuWidth - 12));
    const top = Math.max(12, Math.min(rect.top, window.innerHeight - 286));
    setAccountPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    updateAccountPosition();
    const focusFrame = logoutOpen || changePasswordOpen
      ? null
      : window.requestAnimationFrame(() => signOutButtonRef.current?.focus());

    function closeOnPointer(event: PointerEvent) {
      if (logoutOpen || changePasswordOpen) return;
      const target = event.target as Node;
      if (!accountButtonRef.current?.contains(target) && !accountMenuRef.current?.contains(target)) {
        setAccountOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (logoutOpen || changePasswordOpen) return;
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      accountButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateAccountPosition);
    window.addEventListener("scroll", updateAccountPosition, true);
    return () => {
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateAccountPosition);
      window.removeEventListener("scroll", updateAccountPosition, true);
    };
  }, [accountOpen, changePasswordOpen, logoutOpen, updateAccountPosition]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("seaoil-sidebar-collapsed", String(next));
      document.cookie = `seaoil-sidebar-collapsed=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setAccountOpen(false);
      return next;
    });
  }

  function handleAccountMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const controls = Array.from(
      accountMenuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (controls.length === 0) return;
    event.preventDefault();
    const currentIndex = controls.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? controls.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + controls.length) % controls.length
          : (currentIndex - 1 + controls.length) % controls.length;
    controls[nextIndex]?.focus();
  }

  const copyClass = collapsed
    ? "lg:pointer-events-none lg:w-0 lg:-translate-x-2 lg:opacity-0"
    : "lg:translate-x-0 lg:opacity-100";

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        className="fixed left-4 top-3.5 z-50 flex size-10 items-center justify-center rounded-xl bg-[#014171] text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] lg:hidden"
      >
        <MorphIcon icon={mobileOpen ? X : Menu} size={20} strokeWidth={2} reducedMotion="user" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        aria-label="Primary navigation"
        data-collapsed={collapsed}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-x-hidden border-r border-white/10 bg-[#014171] text-white shadow-xl transition-[width,transform] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="shrink-0 border-b border-white/15 p-2 pl-16 lg:pl-2">
          <div className="flex items-center gap-1">
            <button
              ref={accountButtonRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => {
                if (!accountOpen) updateAccountPosition();
                setAccountOpen((open) => !open);
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown") return;
                event.preventDefault();
                if (!accountOpen) updateAccountPosition();
                setAccountOpen(true);
              }}
              className={`flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left text-[#dfe9f4] transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#7DA8D0] ${collapsed ? "lg:hidden" : ""}`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                <AuthBlob mood="idle" size={38} skin={blobSkin} />
              </div>
              <span className={`min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium transition-all duration-200 ${copyClass}`}>{accountName}</span>
              <span className={`shrink-0 transition-all duration-200 ${copyClass}`}>
                <MorphIcon icon={accountOpen ? ChevronUp : ChevronDown} size={16} strokeWidth={2} reducedMotion="user" />
              </span>
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              aria-expanded="false"
              className={`h-12 min-w-0 flex-1 items-center justify-center rounded-xl bg-white/10 text-[#dfe9f4] transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] ${collapsed ? "hidden lg:flex" : "hidden"}`}
            >
              <MorphIcon icon={Menu} size={20} strokeWidth={2} reducedMotion="user" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              aria-expanded="true"
              className={`hidden size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[#dfe9f4] transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] lg:flex ${collapsed ? "lg:hidden" : ""}`}
            >
              <MorphIcon icon={PanelLeftClose} size={18} strokeWidth={2} reducedMotion="user" />
            </button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2 py-3">
          {items.map((item) => {
            const active = pathname === item.href;
            const sectionActive = active || pathname.startsWith(`${item.href}/`);
            const isSpot = item.href === "/printdash";
            const isPrintOps = item.href === "/printops";
            const isEmployeeServices = item.href === "/portal#print-services";
            const isDropdown = isSpot || isPrintOps || isEmployeeServices;
            const submenuOpen = isSpot
              ? spotOpen
              : isPrintOps
                ? printOpsOpen
                : isEmployeeServices
                  ? employeeServicesOpen
                  : sectionActive;
            const submenuId = isSpot
              ? "spot-submenu"
              : isPrintOps
                ? "printops-submenu"
                : isEmployeeServices
                  ? "employee-print-services-submenu"
                  : undefined;
            return (
              <div key={item.href}>
                {item.separated && <div className="mx-2 my-3 border-t border-white/15" />}
                <div className="group/nav relative">
                  <Link
                    href={item.href}
                    role={isDropdown ? "button" : undefined}
                    aria-current={!isDropdown && active ? "page" : undefined}
                    aria-expanded={isDropdown ? submenuOpen : undefined}
                    aria-controls={submenuId}
                    title={collapsed ? item.label : undefined}
                    onClick={(event) => {
                      if (isSpot) {
                        event.preventDefault();
                        setSpotOpen((open) => !open);
                        return;
                      }
                      if (isPrintOps) {
                        event.preventDefault();
                        setPrintOpsOpen((open) => !open);
                        return;
                      }
                      if (isEmployeeServices) {
                        event.preventDefault();
                        setEmployeeServicesOpen((open) => !open);
                        return;
                      }
                      setMobileOpen(false);
                    }}
                    className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#7DA8D0] ${isDropdown ? "pr-10" : ""} ${
                      active && !isDropdown
                        ? "bg-[#FEF200] text-[#014171]"
                        : sectionActive
                          ? "bg-white/10 text-white"
                          : "text-[#dfe9f4] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center"><StaticIcon icon={item.icon} /></span>
                    <span className={`min-w-0 flex-1 truncate whitespace-nowrap transition-all duration-200 ${copyClass}`}>{item.label}</span>
                  </Link>
                  {isDropdown && item.children && (
                    <button
                      type="button"
                      aria-label={`${submenuOpen ? "Close" : "Open"} ${item.label} menu`}
                      aria-expanded={submenuOpen}
                      aria-controls={submenuId}
                      onClick={() => {
                        if (isSpot) setSpotOpen((open) => !open);
                        if (isPrintOps) setPrintOpsOpen((open) => !open);
                        if (isEmployeeServices) setEmployeeServicesOpen((open) => !open);
                      }}
                      className={`absolute right-1 top-1 flex size-8 items-center justify-center rounded-md text-[#dfe9f4] transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#7DA8D0] ${copyClass}`}
                    >
                      <MorphIcon
                        icon={submenuOpen ? ChevronUp : ChevronDown}
                        size={16}
                        strokeWidth={2}
                        reducedMotion="user"
                      />
                    </button>
                  )}
                </div>

                {item.children && (isDropdown || sectionActive) && (
                  <div
                    id={submenuId}
                    aria-hidden={!submenuOpen}
                    className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                      submenuOpen ? "mt-1 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-1 pl-8 lg:pl-0">
                        {item.children.filter((child) => !child.adminOnly || isAdmin || canManageSpot).map((child) => {
                          const childActive = pathname === child.href;
                          return (
                            <div key={child.href} className="group/child relative">
                              {child.disabled ? (
                                <button
                                  type="button"
                                  disabled
                                  title={collapsed ? child.label : `${child.label} — coming soon`}
                                  className="flex h-9 w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium text-[#dfe9f4]/65"
                                >
                                  <span className="flex size-5 shrink-0 items-center justify-center"><StaticIcon icon={child.icon} size={17} /></span>
                                  <span className={`min-w-0 truncate whitespace-nowrap transition-all duration-200 ${copyClass}`}>{child.label}</span>
                                </button>
                              ) : (
                                <Link
                                  href={child.href}
                                  aria-current={childActive ? "page" : undefined}
                                  title={collapsed ? child.label : undefined}
                                  tabIndex={submenuOpen ? undefined : -1}
                                  onClick={() => setMobileOpen(false)}
                                  className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#7DA8D0] ${
                                    childActive
                                      ? "bg-[#FEF200] text-[#014171]"
                                      : "text-[#dfe9f4] hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <span className="flex size-5 shrink-0 items-center justify-center"><StaticIcon icon={child.icon} size={17} /></span>
                                  <span className={`min-w-0 truncate whitespace-nowrap transition-all duration-200 ${copyClass}`}>{child.label}</span>
                                </Link>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/15 p-2">
          <div className={`flex h-12 items-center gap-3 rounded-xl px-2 ${collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}>
            <div
              className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-base font-black text-[#014171] ${
                logoUrl ? "bg-transparent" : "bg-[#FEF200]"
              }`}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="SEAOIL logo" className="h-full w-full object-contain" />
              ) : (
                "S"
              )}
            </div>
            <div className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-all duration-200 ${copyClass} ${collapsed ? "lg:hidden" : ""}`}>
              <p className="text-sm font-bold leading-tight">SEAOIL</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#9cc0df]">Printer Monitoring</p>
            </div>
          </div>
        </div>
      </aside>

      {accountOpen &&
        createPortal(
          <div
            ref={accountMenuRef}
            role="menu"
            aria-label="User account"
            onKeyDown={handleAccountMenuKeyDown}
            className="fixed z-[70] w-64 origin-top-left rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-2xl"
            style={{ top: accountPosition.top, left: accountPosition.left }}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                <AuthBlob mood="idle" size={42} skin={blobSkin} />
              </div>
              <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{accountName}</p>
            </div>
            <div className="border-b border-slate-100 px-3 py-3" role="group" aria-label="Blob skin color">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Blob skin
              </p>
              <div className="flex items-center justify-between gap-1.5">
                {BLOB_SKINS.map((skin) => {
                  const selected = skin.id === blobSkin;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      aria-label={`${skin.label} blob skin`}
                      title={skin.label}
                      onClick={() => setBlobSkin(skin.id)}
                      className={`flex size-7 items-center justify-center rounded-full border-2 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2 ${
                        selected ? "border-slate-800" : "border-white shadow-[0_0_0_1px_#cbd5e1]"
                      }`}
                      style={{ backgroundColor: skin.swatch }}
                    >
                      {selected && (
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5 text-white drop-shadow-sm" fill="none">
                          <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              aria-haspopup="dialog"
              onClick={() => {
                setAccountOpen(false);
                setChangePasswordOpen(true);
              }}
              className="mt-1 flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
            >
              <StaticIcon icon={KeyRound} size={18} />
              Change password
            </button>
            <button
              type="button"
              role="menuitem"
              disabled
              aria-label="Light Mode"
              className="mt-1 flex h-10 w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-slate-400"
            >
              <StaticIcon icon={Sun} size={18} />
              <span>Light Mode</span>
            </button>
            <button
              ref={signOutButtonRef}
              type="button"
              role="menuitem"
              aria-haspopup="dialog"
              onClick={() => setLogoutOpen(true)}
              className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
            >
              <StaticIcon icon={LogOut} size={18} />
              Sign out
            </button>
          </div>,
          document.body,
        )}

      <LogoutConfirmationDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        triggerRef={signOutButtonRef}
      />
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        triggerRef={accountButtonRef}
      />
    </>
  );
}
