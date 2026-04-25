import React from "react";
import { useConfig } from "#/hooks/query/use-config";
import { useGitUser } from "#/hooks/query/use-git-user";
import { getLoginMethod, LoginMethod } from "#/utils/local-storage";
import reoService, { ReoIdentity } from "#/utils/reo";
import { isProductionDomain } from "#/utils/utils";

const mapLoginMethodToReoType = (method: LoginMethod): ReoIdentity["type"] => {
  switch (method) {
    case LoginMethod.GITHUB:
      return "github";
    case LoginMethod.ENTERPRISE_SSO:
      return "email";
    default:
      return "email";
  }
};

const buildEmailIdentity = (
  email?: string | null,
): ReoIdentity["other_identities"] => {
  if (!email) {
    return undefined;
  }

  return [
    {
      username: email,
      type: "email",
    },
  ];
};

const parseNameFields = (
  fullName?: string | null,
): { firstname?: string; lastname?: string } => {
  if (!fullName) {
    return {};
  }

  const [firstname, ...rest] = fullName.split(" ");
  if (!firstname) {
    return {};
  }

  return {
    firstname,
    lastname: rest.length > 0 ? rest.join(" ") : undefined,
  };
};

const buildReoIdentity = (
  user: {
    login: string;
    email?: string | null;
    name?: string | null;
    company?: string | null;
  },
  loginMethod: LoginMethod,
): ReoIdentity => {
  const { firstname, lastname } = parseNameFields(user.name);

  return {
    username: user.login,
    type: mapLoginMethodToReoType(loginMethod),
    other_identities: buildEmailIdentity(user.email),
    firstname,
    lastname,
    company: user.company || undefined,
  };
};

export const useReoTracking = () => {
  const { data: config } = useConfig();
  const { data: user } = useGitUser();
  const [hasIdentified, setHasIdentified] = React.useState(false);

  React.useEffect(() => {
    const initReo = async () => {
      if (
        config?.app_mode === "saas" &&
        isProductionDomain() &&
        !reoService.isInitialized()
      ) {
        await reoService.init();
      }
    };

    initReo();
  }, [config?.app_mode]);

  React.useEffect(() => {
    if (
      config?.app_mode !== "saas" ||
      !isProductionDomain() ||
      !user ||
      hasIdentified ||
      !reoService.isInitialized()
    ) {
      return;
    }

    const loginMethod = getLoginMethod();
    if (!loginMethod) {
      return;
    }

    const identity = buildReoIdentity(user, loginMethod);
    reoService.identify(identity);
    setHasIdentified(true);
  }, [config?.app_mode, hasIdentified, user]);
};
