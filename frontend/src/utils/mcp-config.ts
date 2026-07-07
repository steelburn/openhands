import {
  MCPConfig,
  MCPSSEServer,
  MCPSHTTPServer,
  MCPStdioServer,
  SettingsValue,
} from "#/types/settings";

const EMPTY_MCP_CONFIG: MCPConfig = {
  sse_servers: [],
  stdio_servers: [],
  shttp_servers: [],
};

type SdkMcpServerConfig = Record<string, SettingsValue>;

function unwrapMcpServers(
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (
    "mcpServers" in value &&
    value.mcpServers &&
    typeof value.mcpServers === "object" &&
    !Array.isArray(value.mcpServers)
  ) {
    return value.mcpServers as Record<string, unknown>;
  }
  return value;
}

function isParsedMcpConfigShape(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === 3 &&
    Array.isArray(value.sse_servers) &&
    Array.isArray(value.stdio_servers) &&
    Array.isArray(value.shttp_servers)
  );
}

function apiKeyFromAuthorizationHeader(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value
      .map(apiKeyFromAuthorizationHeader)
      .find((apiKey) => apiKey !== undefined);
  }

  if (typeof value !== "string" || value.length === 0) return undefined;
  const bearer = value.match(/^Bearer\s+(.+)$/i);
  return bearer ? bearer[1] : value;
}

function apiKeyFromServerConfig(
  serverConfig: Record<string, unknown>,
): string | undefined {
  const { headers } = serverConfig;
  const authorization =
    headers && typeof headers === "object" && !Array.isArray(headers)
      ? ((headers as Record<string, unknown>).Authorization ??
        (headers as Record<string, unknown>).authorization)
      : undefined;
  const headerApiKey = apiKeyFromAuthorizationHeader(authorization);
  if (headerApiKey) return headerApiKey;

  const { auth } = serverConfig;
  return typeof auth === "string" && auth !== "oauth" ? auth : undefined;
}

function getAuthorizationHeaders(apiKey: string | undefined) {
  if (!apiKey) return {};
  return {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  };
}

function getUniqueName(base: string, usedNames: Set<string>): string {
  if (!usedNames.has(base)) {
    return base;
  }
  let suffix = 1;
  while (usedNames.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

export function parseMcpConfig(value: unknown): MCPConfig {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_MCP_CONFIG };
  }

  const obj = value as Record<string, unknown>;

  if (isParsedMcpConfigShape(obj)) {
    return {
      sse_servers: obj.sse_servers as (string | MCPSSEServer)[],
      stdio_servers: obj.stdio_servers as MCPStdioServer[],
      shttp_servers: obj.shttp_servers as (string | MCPSHTTPServer)[],
    };
  }

  const mcpServers = unwrapMcpServers(obj);

  const sseServers: (string | MCPSSEServer)[] = [];
  const stdioServers: MCPStdioServer[] = [];
  const shttpServers: (string | MCPSHTTPServer)[] = [];

  for (const [serverName, rawServerConfig] of Object.entries(mcpServers)) {
    if (
      !rawServerConfig ||
      typeof rawServerConfig !== "object" ||
      Array.isArray(rawServerConfig)
    ) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const serverConfig = rawServerConfig as Record<string, unknown>;
    const url =
      typeof serverConfig.url === "string" ? serverConfig.url : undefined;

    if (url) {
      const transport = serverConfig.transport as string | undefined;
      const apiKey = apiKeyFromServerConfig(serverConfig);

      if (transport === "sse") {
        const server: MCPSSEServer = {
          name: serverName,
          url,
        };
        if (apiKey) server.api_key = apiKey;
        sseServers.push(server);
      } else {
        const server: MCPSHTTPServer = {
          name: serverName,
          url,
        };
        if (apiKey) server.api_key = apiKey;
        if (serverConfig.timeout != null) {
          server.timeout = serverConfig.timeout as number;
        }
        shttpServers.push(server);
      }
    } else if (typeof serverConfig.command === "string") {
      const stdioServer: MCPStdioServer = {
        name: serverName,
        command: serverConfig.command,
      };
      if (serverConfig.args) {
        stdioServer.args = serverConfig.args as string[];
      }
      if (serverConfig.env) {
        stdioServer.env = serverConfig.env as Record<string, string>;
      }
      stdioServers.push(stdioServer);
    }
  }

  return {
    sse_servers: sseServers,
    stdio_servers: stdioServers,
    shttp_servers: shttpServers,
  };
}

export function toSdkMcpConfig(
  config: MCPConfig,
): Record<string, SdkMcpServerConfig> | null {
  const mcpServers: Record<string, SdkMcpServerConfig> = {};
  const usedNames = new Set<string>();

  for (const entry of config.sse_servers) {
    const server: SdkMcpServerConfig = {};
    if (typeof entry === "string") {
      server.url = entry;
    } else {
      server.url = entry.url;
      Object.assign(server, getAuthorizationHeaders(entry.api_key));
    }
    server.transport = "sse";

    const baseName =
      typeof entry !== "string" && entry.name ? entry.name : "sse";
    const name = getUniqueName(baseName, usedNames);
    usedNames.add(name);
    mcpServers[name] = server;
  }

  for (const entry of config.shttp_servers) {
    const server: SdkMcpServerConfig = {};
    if (typeof entry === "string") {
      server.url = entry;
    } else {
      server.url = entry.url;
      Object.assign(server, getAuthorizationHeaders(entry.api_key));
      if (entry.timeout != null) server.timeout = entry.timeout;
    }

    const baseName =
      typeof entry !== "string" && entry.name ? entry.name : "shttp";
    const name = getUniqueName(baseName, usedNames);
    usedNames.add(name);
    mcpServers[name] = server;
  }

  for (const entry of config.stdio_servers) {
    const server: SdkMcpServerConfig = {
      command: entry.command,
    };
    if (entry.args) server.args = entry.args;
    if (entry.env) server.env = entry.env;

    const baseName = entry.name || "stdio";
    const name = getUniqueName(baseName, usedNames);
    usedNames.add(name);
    mcpServers[name] = server;
  }

  return Object.keys(mcpServers).length > 0 ? mcpServers : null;
}
