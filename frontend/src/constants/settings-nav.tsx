import { FiUsers, FiBriefcase } from "react-icons/fi";
import CreditCardIcon from "#/icons/credit-card.svg?react";
import KeyIcon from "#/icons/key.svg?react";
import LightbulbIcon from "#/icons/lightbulb.svg?react";
import LockIcon from "#/icons/lock.svg?react";
import MemoryIcon from "#/icons/memory_icon.svg?react";
import ServerProcessIcon from "#/icons/server-process.svg?react";
import SettingsGearIcon from "#/icons/settings-gear.svg?react";
import CircuitIcon from "#/icons/u-circuit.svg?react";
import PuzzlePieceIcon from "#/icons/u-puzzle-piece.svg?react";
import UserIcon from "#/icons/user.svg?react";

export type SettingsNavSection =
  | "org"
  | "personal"
  | "user"
  | "billing"
  | "other";

export interface SettingsNavItem {
  icon: React.ReactElement;
  to: string;
  text: string;
  section?: SettingsNavSection;
  // When true, this item is only shown if the `enable_acp` feature flag is on.
  acpGated?: boolean;
  // When true, the item is rendered disabled (with a tooltip) while the
  // active personal agent is ACP. ``useAcpGuard`` reads the same flag to
  // redirect routes that match this set, so adding/removing a route from
  // the disabled set is a single edit.
  disableUnderAcp?: boolean;
}

export const SAAS_NAV_ITEMS: SettingsNavItem[] = [
  {
    icon: <FiBriefcase size={22} />,
    to: "/settings/org",
    text: "SETTINGS$NAV_ORGANIZATION",
    section: "org",
  },
  {
    icon: <FiUsers size={22} />,
    to: "/settings/org-members",
    text: "SETTINGS$NAV_ORG_MEMBERS",
    section: "org",
  },
  {
    icon: <CircuitIcon width={22} height={22} />,
    to: "/settings/org-defaults",
    text: "COMMON$LANGUAGE_MODEL_LLM",
    section: "org",
  },
  {
    icon: <MemoryIcon width={22} height={22} />,
    to: "/settings/org-defaults/condenser",
    text: "SETTINGS$NAV_CONDENSER",
    section: "org",
  },
  {
    icon: <LockIcon width={22} height={22} />,
    to: "/settings/org-defaults/verification",
    text: "SETTINGS$NAV_VERIFICATION",
    section: "org",
  },
  {
    icon: <CircuitIcon width={22} height={22} />,
    to: "/settings/agent",
    text: "SETTINGS$AGENT",
    section: "personal",
    acpGated: true,
  },
  {
    icon: <CircuitIcon width={22} height={22} />,
    to: "/settings",
    text: "COMMON$LANGUAGE_MODEL_LLM",
    section: "personal",
    disableUnderAcp: true,
  },
  {
    icon: <MemoryIcon width={22} height={22} />,
    to: "/settings/condenser",
    text: "SETTINGS$NAV_CONDENSER",
    section: "personal",
    disableUnderAcp: true,
  },
  {
    icon: <LockIcon width={22} height={22} />,
    to: "/settings/verification",
    text: "SETTINGS$NAV_VERIFICATION",
    section: "personal",
  },
  {
    icon: <KeyIcon width={22} height={22} />,
    to: "/settings/api-keys",
    text: "SETTINGS$NAV_API_KEYS",
    section: "personal",
  },
  {
    icon: <KeyIcon width={22} height={22} />,
    to: "/settings/secrets",
    text: "SETTINGS$NAV_SECRETS",
    section: "personal",
  },
  {
    icon: <ServerProcessIcon width={22} height={22} />,
    to: "/settings/mcp",
    text: "SETTINGS$NAV_MCP",
    section: "personal",
    disableUnderAcp: true,
  },
  {
    icon: <UserIcon width={22} height={22} />,
    to: "/settings/user",
    text: "SETTINGS$NAV_USER",
    section: "user",
  },
  {
    icon: <SettingsGearIcon width={22} height={22} />,
    to: "/settings/app",
    text: "SETTINGS$NAV_APPLICATION",
    section: "user",
  },
  {
    icon: <CreditCardIcon width={22} height={22} />,
    to: "/settings/billing",
    text: "SETTINGS$NAV_BILLING",
    section: "billing",
  },
  {
    icon: <PuzzlePieceIcon width={22} height={22} />,
    to: "/settings/integrations",
    text: "SETTINGS$NAV_INTEGRATIONS",
    section: "other",
  },
  {
    icon: <LightbulbIcon width={22} height={22} />,
    to: "/settings/skills",
    text: "SETTINGS$NAV_SKILLS",
    section: "other",
  },
];

export const OSS_NAV_ITEMS: SettingsNavItem[] = [
  {
    icon: <CircuitIcon width={22} height={22} />,
    to: "/settings/agent",
    text: "SETTINGS$AGENT",
    acpGated: true,
  },
  {
    icon: <CircuitIcon width={22} height={22} />,
    to: "/settings",
    text: "SETTINGS$NAV_LLM",
    disableUnderAcp: true,
  },
  {
    icon: <MemoryIcon width={22} height={22} />,
    to: "/settings/condenser",
    text: "SETTINGS$NAV_CONDENSER",
    disableUnderAcp: true,
  },
  {
    icon: <LockIcon width={22} height={22} />,
    to: "/settings/verification",
    text: "SETTINGS$NAV_VERIFICATION",
  },
  {
    icon: <ServerProcessIcon width={22} height={22} />,
    to: "/settings/mcp",
    text: "SETTINGS$NAV_MCP",
    disableUnderAcp: true,
  },
  {
    icon: <LightbulbIcon width={22} height={22} />,
    to: "/settings/skills",
    text: "SETTINGS$NAV_SKILLS",
  },
  {
    icon: <PuzzlePieceIcon width={22} height={22} />,
    to: "/settings/integrations",
    text: "SETTINGS$NAV_INTEGRATIONS",
  },
  {
    icon: <SettingsGearIcon width={22} height={22} />,
    to: "/settings/app",
    text: "SETTINGS$NAV_APPLICATION",
  },
  {
    icon: <KeyIcon width={22} height={22} />,
    to: "/settings/secrets",
    text: "SETTINGS$NAV_SECRETS",
  },
];

/** Paths whose ``disableUnderAcp`` flag is set — derived from the canonical
 *  nav lists so the disabled set has no parallel definition. Consumed by
 *  ``useSettingsNavItems`` (renders disabled state + tooltip) and
 *  ``useAcpGuard`` (redirects to /settings/agent). */
export const ACP_DISABLED_PATHS = new Set<string>(
  [...SAAS_NAV_ITEMS, ...OSS_NAV_ITEMS]
    .filter((item) => item.disableUnderAcp)
    .map((item) => item.to),
);
