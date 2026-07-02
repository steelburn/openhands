import React from "react";
import { usePostHog } from "posthog-js/react";
import { useConfig } from "./query/use-config";
import { useMe } from "./query/use-me";
import { useGitUser } from "./query/use-git-user";

/**
 * Identifies the current user to PostHog using the same distinct_id
 * that the server-side AnalyticsService uses (keycloak user_id in SaaS
 * mode). This ensures cross-domain tracking works: the anonymous
 * distinct_id bootstrapped from the marketing site gets merged with
 * the keycloak user_id that every server-side event uses.
 *
 * In OSS mode, falls back to the Git user login.
 */
export const usePostHogIdentify = () => {
  const posthog = usePostHog();
  const { data: config } = useConfig();
  const { data: me } = useMe();
  const { data: gitUser } = useGitUser();
  const hasIdentifiedRef = React.useRef(false);

  React.useEffect(() => {
    if (!posthog || hasIdentifiedRef.current) return;

    if (config?.app_mode === "saas" && me?.user_id) {
      posthog.identify(me.user_id, {
        email: me.email,
      });
      hasIdentifiedRef.current = true;
    } else if (config?.app_mode === "oss" && gitUser) {
      posthog.identify(gitUser.login, {
        company: gitUser.company,
        name: gitUser.name,
        email: gitUser.email,
        user: gitUser.login,
        mode: "oss",
      });
      hasIdentifiedRef.current = true;
    }
  }, [posthog, config?.app_mode, me, gitUser]);
};
