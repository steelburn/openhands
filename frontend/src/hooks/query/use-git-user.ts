import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import React from "react";
import { usePostHog } from "posthog-js/react";
import UserService from "#/api/user-service/user-service.api";
import { useShouldShowUserFeatures } from "#/hooks/use-should-show-user-features";
import { useLogout } from "#/hooks/mutation/use-logout";
import { useConfig } from "#/hooks/query/use-config";

type GitUser = Awaited<ReturnType<typeof UserService.getUser>>;

export const useGitUser = () => {
  const posthog = usePostHog();
  const { data: config } = useConfig();
  const logout = useLogout();
  const shouldFetchUser = useShouldShowUserFeatures();

  const user = useQuery<GitUser, AxiosError>({
    queryKey: ["user"],
    queryFn: UserService.getUser,
    enabled: shouldFetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });

  React.useEffect(() => {
    if (user.data) {
      posthog.identify(user.data.login, {
        company: user.data.company,
        name: user.data.name,
        email: user.data.email,
        user: user.data.login,
        mode: config?.app_mode || "oss",
      });
    }
  }, [config?.app_mode, posthog, user.data]);

  React.useEffect(() => {
    if (user.error?.response?.status === 401 && config?.app_mode === "saas") {
      logout.mutate();
    }
  }, [config?.app_mode, logout, user.error?.response?.status]);

  return user;
};
