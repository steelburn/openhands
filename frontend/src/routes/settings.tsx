import { useMemo } from "react";
import { Outlet, redirect, useLocation, useMatches } from "react-router";
import { useTranslation } from "react-i18next";
import { Route } from "./+types/settings";
import OptionService from "#/api/option-service/option-service.api";
import { queryClient } from "#/query-client-config";
import { SettingsLayout } from "#/components/features/settings";
import { WebClientConfig } from "#/api/option-service/option.types";
import { QUERY_KEYS, CONFIG_CACHE_OPTIONS } from "#/hooks/query/query-keys";
import { Organization } from "#/types/org";
import { Typography } from "#/ui/typography";
import { useSettingsNavItems } from "#/hooks/use-settings-nav-items";
import { getActiveOrganizationUser } from "#/utils/org/permission-checks";
import { getSelectedOrganizationIdFromStore } from "#/stores/selected-organization-store";
import { rolePermissions } from "#/utils/org/permissions";
import { isBillingHidden } from "#/utils/org/billing-visibility";
import {
  getFirstAvailablePath,
  isSettingsPageHidden,
} from "#/utils/settings-utils";
import { useOrgTypeAndAccess } from "#/hooks/use-org-type-and-access";
import { useConfig } from "#/hooks/query/use-config";
import { useMe } from "#/hooks/query/use-me";
import { OrgWideSettingsBadge } from "#/components/features/settings/org-wide-settings-badge";

const SAAS_ONLY_PATHS = [
  "/settings/user",
  "/settings/billing",
  "/settings/credits",
  "/settings/api-keys",
  "/settings/team",
  "/settings/org",
];

const ORG_WIDE_BADGE_PATHS = new Set<string>([
  "/settings/org-defaults",
  "/settings/org-defaults/condenser",
  "/settings/org-defaults/verification",
]);

export const clientLoader = async ({ request }: Route.ClientLoaderArgs) => {
  const url = new URL(request.url);
  const { pathname } = url;

  const config = await queryClient.fetchQuery<WebClientConfig>({
    queryKey: QUERY_KEYS.WEB_CLIENT_CONFIG,
    queryFn: OptionService.getConfig,
    ...CONFIG_CACHE_OPTIONS,
  });

  const isSaas = config?.app_mode === "saas";
  const featureFlags = config?.feature_flags;

  if (!isSaas && SAAS_ONLY_PATHS.includes(pathname)) {
    return redirect("/settings");
  }

  if (isSettingsPageHidden(pathname, featureFlags)) {
    const fallbackPath = getFirstAvailablePath(isSaas, featureFlags);
    if (fallbackPath && fallbackPath !== pathname) {
      return redirect(fallbackPath);
    }
  }

  if (
    pathname === "/settings/billing" ||
    pathname === "/settings/org" ||
    pathname === "/settings/org-members"
  ) {
    const user = await getActiveOrganizationUser();
    const orgId = getSelectedOrganizationIdFromStore();
    const organizationsData = queryClient.getQueryData<{
      items: Organization[];
      currentOrgId: string | null;
    }>(["organizations"]);
    const selectedOrg = organizationsData?.items?.find(
      (org) => org.id === orgId,
    );
    const isPersonalOrg = selectedOrg?.is_personal === true;
    const isTeamOrg = !!selectedOrg && !selectedOrg.is_personal;

    if (pathname === "/settings/billing") {
      if (
        !user ||
        isBillingHidden(
          config,
          rolePermissions[user.role ?? "member"].includes("view_billing"),
        ) ||
        isTeamOrg
      ) {
        if (isSaas) {
          const fallbackPath = getFirstAvailablePath(isSaas, featureFlags);
          return redirect(fallbackPath ?? "/settings");
        }
      }
    }

    if (pathname === "/settings/org" || pathname === "/settings/org-members") {
      const role = user?.role ?? "member";
      const requiredPermission =
        pathname === "/settings/org"
          ? "view_billing"
          : "invite_user_to_organization";

      if (
        !user ||
        !rolePermissions[role].includes(requiredPermission) ||
        isPersonalOrg
      ) {
        return redirect("/settings");
      }
    }
  }

  return null;
};

function SettingsScreen() {
  const { t } = useTranslation();
  const location = useLocation();
  const matches = useMatches();
  const navItems = useSettingsNavItems();
  const { data: config } = useConfig();
  const { isTeamOrg } = useOrgTypeAndAccess();
  const { data: me } = useMe();

  const isOrgWideBadgePath = ORG_WIDE_BADGE_PATHS.has(location.pathname);
  const isSaasMode = config?.app_mode === "saas";
  const shouldShowOrgWideBadge = isOrgWideBadgePath && isTeamOrg && isSaasMode;
  const orgWideBadgeVariant =
    me?.role === "member" ? "managed-by-admin" : "org-wide";

  const currentSectionTitle = useMemo(() => {
    const currentRenderedItem = navItems.find(
      (item) => item.type === "item" && item.item.to === location.pathname,
    );
    if (currentRenderedItem && currentRenderedItem.type === "item") {
      return currentRenderedItem.item.text;
    }
    const firstItem = navItems.find((item) => item.type === "item");
    return firstItem && firstItem.type === "item"
      ? firstItem.item.text
      : "SETTINGS$TITLE";
  }, [location.pathname, navItems]);

  const routeHandle = matches.find((m) => m.pathname === location.pathname)
    ?.handle as { hideTitle?: boolean } | undefined;
  const shouldHideTitle = routeHandle?.hideTitle === true;

  return (
    <main data-testid="settings-screen" className="h-full">
      <SettingsLayout navigationItems={navItems}>
        <div className="flex flex-col gap-6 h-full">
          {!shouldHideTitle && (
            <div className="flex items-center gap-3 flex-wrap">
              <Typography.H2>{t(currentSectionTitle)}</Typography.H2>
              {shouldShowOrgWideBadge && (
                <OrgWideSettingsBadge variant={orgWideBadgeVariant} />
              )}
            </div>
          )}
          <div className="flex-1 overflow-auto custom-scrollbar-always">
            <Outlet />
          </div>
        </div>
      </SettingsLayout>
    </main>
  );
}

export default SettingsScreen;
