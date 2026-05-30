export interface NavItem {
  id: string;
  title: string;
  route: string;
  children?: NavItem[];
  badge?: string;
  isNew?: boolean;
}

export interface TopTab {
  id: string;
  title: string;
  slug: string;
  icon?: string;
}

export const topTabs: TopTab[] = [
  { id: 'introduction', title: 'Introduction', slug: '/' },
  { id: 'getting-started', title: 'Getting Started', slug: '/getting-started' },
  { id: 'installation', title: 'Installation', slug: '/installation' },
  { id: 'products', title: 'Products', slug: '/products' },
  { id: 'features', title: 'Features', slug: '/features' },
  { id: 'api', title: 'API Reference', slug: '/api' },
  { id: 'configuration', title: 'Configuration', slug: '/configuration' },
  { id: 'integrations', title: 'Integrations', slug: '/integrations' },
  { id: 'enterprise', title: 'Enterprise', slug: '/enterprise' },
  { id: 'contributing', title: 'Contributing', slug: '/contributing' },
  { id: 'changelog', title: 'Changelog', slug: '/changelog' },
];

export const navigationByTab: Record<string, NavItem[]> = {
  introduction: [
    {
      id: 'what-is-openhands',
      title: 'What is OpenHands?',
      route: '/',
    },
    {
      id: 'architecture',
      title: 'Architecture Overview',
      route: '/architecture',
    },
    {
      id: 'how-it-works',
      title: 'How Agents Work',
      route: '/how-it-works',
    },
    {
      id: 'comparison',
      title: 'Comparison Table',
      route: '/comparison',
    },
    {
      id: 'faq',
      title: 'FAQ',
      route: '/faq',
    },
  ],

  'getting-started': [
    {
      id: 'gs-cloud',
      title: 'Quickstart — Cloud',
      route: '/getting-started/cloud',
    },
    {
      id: 'gs-local-oss',
      title: 'Quickstart — Local GUI (OSS)',
      route: '/getting-started/local-oss',
    },
    {
      id: 'gs-local-saas',
      title: 'Quickstart — Local GUI (SaaS)',
      route: '/getting-started/local-saas',
    },
    {
      id: 'gs-cli',
      title: 'Quickstart — CLI',
      route: '/getting-started/cli',
    },
    {
      id: 'gs-sdk',
      title: 'Quickstart — SDK',
      route: '/getting-started/sdk',
    },
    {
      id: 'onboarding',
      title: 'Onboarding Flow',
      route: '/getting-started/onboarding',
    },
  ],

  installation: [
    {
      id: 'install-local-oss',
      title: 'Local GUI — OSS',
      route: '/installation/local-oss',
      children: [
        { id: 'docker', title: 'Docker (Recommended)', route: '/installation/local-oss/docker' },
        { id: 'docker-compose', title: 'Docker Compose', route: '/installation/local-oss/docker-compose' },
        { id: 'macos', title: 'macOS from Source', route: '/installation/local-oss/macos' },
        { id: 'linux', title: 'Linux from Source', route: '/installation/local-oss/linux' },
        { id: 'windows', title: 'Windows (WSL2)', route: '/installation/local-oss/windows' },
        { id: 'devcontainer', title: 'Dev Container', route: '/installation/local-oss/devcontainer' },
        { id: 'docker-dev', title: 'Docker Dev Environment', route: '/installation/local-oss/docker-dev' },
        { id: 'no-sudo', title: 'No-sudo (Conda/Mamba)', route: '/installation/local-oss/no-sudo' },
      ],
    },
    {
      id: 'install-local-saas',
      title: 'Local GUI — SaaS Mode',
      route: '/installation/local-saas',
      children: [
        { id: 'saas-overview', title: 'Overview', route: '/installation/local-saas' },
        { id: 'saas-prereqs', title: 'Prerequisites', route: '/installation/local-saas/prerequisites' },
        { id: 'saas-run', title: 'Build & Run', route: '/installation/local-saas/run' },
        { id: 'saas-llm', title: 'LLM Configuration', route: '/installation/local-saas/llm-config' },
        { id: 'saas-headless', title: 'Headless / CLI Config', route: '/installation/local-saas/headless-config' },
      ],
    },
    {
      id: 'install-cloud',
      title: 'OpenHands Cloud',
      route: '/installation/cloud',
      children: [
        { id: 'cloud-access', title: 'Accessing Cloud', route: '/installation/cloud' },
        { id: 'cloud-repo', title: 'Connecting a Repository', route: '/installation/cloud/connect-repo' },
        { id: 'cloud-org', title: 'Organization Setup', route: '/installation/cloud/organization' },
        { id: 'cloud-billing', title: 'Billing & Plans', route: '/installation/cloud/billing' },
      ],
    },
    {
      id: 'install-enterprise',
      title: 'Enterprise Self-Hosted',
      route: '/installation/enterprise',
      children: [
        { id: 'ent-overview', title: 'Overview', route: '/installation/enterprise' },
        { id: 'ent-k8s', title: 'Kubernetes Setup', route: '/installation/enterprise/kubernetes' },
        { id: 'ent-db', title: 'Database & Storage', route: '/installation/enterprise/database' },
        { id: 'ent-auth', title: 'Authentication', route: '/installation/enterprise/auth' },
        { id: 'ent-maint', title: 'Maintenance Tasks', route: '/installation/enterprise/maintenance' },
        { id: 'ent-license', title: 'License', route: '/installation/enterprise/license' },
      ],
    },
    {
      id: 'install-sdk',
      title: 'SDK',
      route: '/installation/sdk',
    },
    {
      id: 'install-cli',
      title: 'CLI',
      route: '/installation/cli',
    },
  ],

  products: [
    { id: 'prod-sdk', title: 'SDK Overview', route: '/products/sdk' },
    { id: 'prod-cli', title: 'CLI Overview', route: '/products/cli' },
    { id: 'prod-local-gui', title: 'Local GUI Overview', route: '/products/local-gui' },
    { id: 'prod-cloud', title: 'Cloud Overview', route: '/products/cloud' },
    { id: 'prod-enterprise', title: 'Enterprise Overview', route: '/products/enterprise' },
  ],

  features: [
    {
      id: 'feat-core',
      title: 'Core Agent Features',
      route: '/features',
      children: [
        { id: 'feat-conversations', title: 'Conversations', route: '/features/conversations' },
        { id: 'feat-agent-state', title: 'Agent State Machine', route: '/features/agent-state' },
        { id: 'feat-planner', title: 'Task Planning', route: '/features/planner' },
        { id: 'feat-sandbox', title: 'Sandbox Execution', route: '/features/sandbox' },
        { id: 'feat-file-editing', title: 'File Editing', route: '/features/file-editing' },
        { id: 'feat-terminal', title: 'Terminal', route: '/features/terminal' },
        { id: 'feat-browser', title: 'Browser Control', route: '/features/browser' },
        { id: 'feat-vscode', title: 'VSCode Integration', route: '/features/vscode' },
        { id: 'feat-sharing', title: 'Shared Conversations', route: '/features/sharing' },
        { id: 'feat-recent', title: 'Recent Conversations', route: '/features/recent-conversations' },
      ],
    },
    {
      id: 'feat-settings',
      title: 'Settings & Configuration',
      route: '/features/settings',
      children: [
        { id: 'feat-llm', title: 'LLM Settings', route: '/features/settings/llm' },
        { id: 'feat-agent-settings', title: 'Agent Settings', route: '/features/settings/agent' },
        { id: 'feat-condenser', title: 'Condenser Settings', route: '/features/settings/condenser' },
        { id: 'feat-verification', title: 'Verification Settings', route: '/features/settings/verification' },
        { id: 'feat-mcp-settings', title: 'MCP Settings', route: '/features/settings/mcp' },
        { id: 'feat-skills-settings', title: 'Skills Settings', route: '/features/settings/skills' },
        { id: 'feat-secrets', title: 'Secrets Management', route: '/features/settings/secrets' },
        { id: 'feat-api-keys', title: 'API Keys', route: '/features/settings/api-keys' },
        { id: 'feat-user-settings', title: 'User Settings', route: '/features/settings/user' },
      ],
    },
    {
      id: 'feat-org',
      title: 'Org & Cloud Features',
      route: '/features/org',
      children: [
        { id: 'feat-org-mgmt', title: 'Organization Management', route: '/features/org' },
        { id: 'feat-org-defaults', title: 'Org Defaults', route: '/features/org-defaults' },
        { id: 'feat-billing', title: 'Billing', route: '/features/billing' },
      ],
    },
    {
      id: 'feat-dev',
      title: 'Developer/Integration',
      route: '/features/dev',
      children: [
        { id: 'feat-skills', title: 'Skills System', route: '/features/skills' },
        { id: 'feat-webhooks', title: 'Webhooks', route: '/features/webhooks' },
        { id: 'feat-mcp', title: 'MCP Protocol', route: '/features/mcp' },
        { id: 'feat-pending', title: 'Pending Messages', route: '/features/pending-messages' },
        { id: 'feat-analytics', title: 'Analytics', route: '/features/analytics' },
      ],
    },
  ],

  api: [
    {
      id: 'api-overview',
      title: 'Overview',
      route: '/api',
      children: [
        { id: 'api-intro', title: 'API Overview', route: '/api' },
        { id: 'api-auth', title: 'Authentication', route: '/api/auth' },
      ],
    },
    {
      id: 'api-conversations',
      title: 'Conversations',
      route: '/api/conversations',
      children: [
        { id: 'api-conv-list', title: 'List Conversations', route: '/api/conversations/list' },
        { id: 'api-conv-count', title: 'Count Conversations', route: '/api/conversations/count' },
        { id: 'api-conv-start', title: 'Start Conversation', route: '/api/conversations/start' },
        { id: 'api-conv-update', title: 'Update Conversation', route: '/api/conversations/update' },
        { id: 'api-conv-delete', title: 'Delete Conversation', route: '/api/conversations/delete' },
        { id: 'api-conv-send', title: 'Send Message', route: '/api/conversations/send-message' },
        { id: 'api-conv-stream', title: 'Stream Start', route: '/api/conversations/stream' },
        { id: 'api-conv-export', title: 'Export Conversation', route: '/api/conversations/export' },
        { id: 'api-conv-file', title: 'Read File', route: '/api/conversations/file' },
        { id: 'api-conv-skills', title: 'Get Skills', route: '/api/conversations/skills' },
        { id: 'api-conv-hooks', title: 'Get Hooks', route: '/api/conversations/hooks' },
        { id: 'api-conv-profile', title: 'Switch Profile', route: '/api/conversations/profile' },
        { id: 'api-conv-tasks', title: 'Start Tasks', route: '/api/conversations/start-tasks' },
      ],
    },
    {
      id: 'api-events',
      title: 'Events',
      route: '/api/events',
      children: [
        { id: 'api-events-list', title: 'List Events', route: '/api/events/list' },
        { id: 'api-events-count', title: 'Count Events', route: '/api/events/count' },
        { id: 'api-events-search', title: 'Search Events', route: '/api/events/search' },
      ],
    },
    {
      id: 'api-sandboxes',
      title: 'Sandboxes',
      route: '/api/sandboxes',
      children: [
        { id: 'api-sb-list', title: 'List Sandboxes', route: '/api/sandboxes/list' },
        { id: 'api-sb-create', title: 'Create Sandbox', route: '/api/sandboxes/create' },
        { id: 'api-sb-pause', title: 'Pause Sandbox', route: '/api/sandboxes/pause' },
        { id: 'api-sb-resume', title: 'Resume Sandbox', route: '/api/sandboxes/resume' },
        { id: 'api-sb-delete', title: 'Delete Sandbox', route: '/api/sandboxes/delete' },
        { id: 'api-sb-secrets', title: 'Sandbox Secrets', route: '/api/sandboxes/secrets' },
      ],
    },
    {
      id: 'api-settings',
      title: 'Settings',
      route: '/api/settings',
      children: [
        { id: 'api-settings-get', title: 'Get Settings', route: '/api/settings/get' },
        { id: 'api-settings-update', title: 'Update Settings', route: '/api/settings/update' },
        { id: 'api-settings-agent', title: 'Agent Schema', route: '/api/settings/agent-schema' },
        { id: 'api-settings-conv', title: 'Conversation Schema', route: '/api/settings/conversation-schema' },
        { id: 'api-settings-profiles', title: 'List Profiles', route: '/api/settings/profiles' },
        { id: 'api-settings-profile', title: 'Get Profile', route: '/api/settings/profile-detail' },
        { id: 'api-settings-profile-create', title: 'Create Profile', route: '/api/settings/profile-create' },
        { id: 'api-settings-profile-delete', title: 'Delete Profile', route: '/api/settings/profile-delete' },
        { id: 'api-settings-profile-activate', title: 'Activate Profile', route: '/api/settings/profile-activate' },
        { id: 'api-settings-profile-rename', title: 'Rename Profile', route: '/api/settings/profile-rename' },
      ],
    },
    {
      id: 'api-secrets',
      title: 'Secrets',
      route: '/api/secrets',
      children: [
        { id: 'api-secrets-list', title: 'List Secrets', route: '/api/secrets/list' },
        { id: 'api-secrets-create', title: 'Create Secret', route: '/api/secrets/create' },
        { id: 'api-secrets-update', title: 'Update Secret', route: '/api/secrets/update' },
        { id: 'api-secrets-delete', title: 'Delete Secret', route: '/api/secrets/delete' },
      ],
    },
    {
      id: 'api-git',
      title: 'Git',
      route: '/api/git',
      children: [
        { id: 'api-git-installs', title: 'Search Installations', route: '/api/git/installations' },
        { id: 'api-git-repos', title: 'Search Repositories', route: '/api/git/repositories' },
        { id: 'api-git-branches', title: 'Search Branches', route: '/api/git/branches' },
        { id: 'api-git-tasks', title: 'Suggested Tasks', route: '/api/git/tasks' },
      ],
    },
    {
      id: 'api-webhooks',
      title: 'Webhooks',
      route: '/api/webhooks',
      children: [
        { id: 'api-wh-convs', title: 'Webhook for Conversations', route: '/api/webhooks/conversations' },
        { id: 'api-wh-events', title: 'Webhook for Events', route: '/api/webhooks/events' },
        { id: 'api-wh-secrets', title: 'Webhook Secrets', route: '/api/webhooks/secrets' },
      ],
    },
    {
      id: 'api-users',
      title: 'Users',
      route: '/api/users',
      children: [
        { id: 'api-users-me', title: 'Get Current User', route: '/api/users/me' },
        { id: 'api-users-git', title: 'Get Git Info', route: '/api/users/git-info' },
        { id: 'api-users-skills', title: 'Get Skills', route: '/api/users/skills' },
      ],
    },
    {
      id: 'api-config',
      title: 'Config & Status',
      route: '/api/config',
      children: [
        { id: 'api-config-web', title: 'Web Client Config', route: '/api/config' },
        { id: 'api-health', title: 'Health / Readiness', route: '/api/health' },
      ],
    },
    {
      id: 'api-mcp',
      title: 'MCP',
      route: '/api/mcp',
      children: [
        { id: 'api-mcp-overview', title: 'MCP Overview', route: '/api/mcp' },
        { id: 'api-mcp-tools', title: 'MCP Tools', route: '/api/mcp/tools' },
      ],
    },
    {
      id: 'api-enterprise',
      title: 'Enterprise APIs',
      route: '/api/enterprise',
      badge: 'Enterprise',
      children: [
        { id: 'api-ent-auth', title: 'Auth', route: '/api/enterprise/auth' },
        { id: 'api-ent-orgs', title: 'Org Management', route: '/api/enterprise/orgs' },
        { id: 'api-ent-members', title: 'Org Members', route: '/api/enterprise/org-members' },
        { id: 'api-ent-invites', title: 'Org Invitations', route: '/api/enterprise/invitations' },
        { id: 'api-ent-profiles', title: 'Org Profiles', route: '/api/enterprise/org-profiles' },
        { id: 'api-ent-keys', title: 'API Keys', route: '/api/enterprise/api-keys' },
        { id: 'api-ent-billing', title: 'Billing', route: '/api/enterprise/billing' },
        { id: 'api-ent-analytics', title: 'Analytics Events', route: '/api/enterprise/analytics' },
        { id: 'api-ent-git', title: 'GitHub/Bitbucket Proxy', route: '/api/enterprise/git-proxy' },
        { id: 'api-ent-oauth', title: 'OAuth Device', route: '/api/enterprise/oauth-device' },
      ],
    },
  ],

  configuration: [
    { id: 'config-all', title: 'All Config Options', route: '/configuration' },
    { id: 'config-env', title: 'Environment Variables', route: '/configuration/env-vars' },
    { id: 'config-llm', title: 'LLM Configuration', route: '/configuration/llm' },
    { id: 'config-agent', title: 'Agent Configuration', route: '/configuration/agent' },
    { id: 'config-condenser', title: 'Condenser Configuration', route: '/configuration/condenser' },
    { id: 'config-sandbox', title: 'Sandbox Configuration', route: '/configuration/sandbox' },
    { id: 'config-docker', title: 'Docker Image Reference', route: '/configuration/docker-images' },
  ],

  integrations: [
    { id: 'int-github', title: 'GitHub', route: '/integrations/github' },
    { id: 'int-gitlab', title: 'GitLab', route: '/integrations/gitlab' },
    { id: 'int-bitbucket', title: 'Bitbucket Cloud', route: '/integrations/bitbucket' },
    { id: 'int-bitbucket-dc', title: 'Bitbucket Data Center', route: '/integrations/bitbucket-dc' },
    { id: 'int-azure', title: 'Azure DevOps', route: '/integrations/azure-devops' },
    { id: 'int-forgejo', title: 'Forgejo', route: '/integrations/forgejo' },
    { id: 'int-jira', title: 'Jira', route: '/integrations/jira' },
    { id: 'int-slack', title: 'Slack', route: '/integrations/slack' },
    { id: 'int-linear', title: 'Linear', route: '/integrations/linear' },
    { id: 'int-mcp', title: 'MCP Servers', route: '/integrations/mcp' },
  ],

  enterprise: [
    { id: 'ent-arch', title: 'Architecture', route: '/enterprise/architecture' },
    { id: 'ent-install', title: 'Installation', route: '/enterprise/installation' },
    { id: 'ent-auth', title: 'Authentication & SSO', route: '/enterprise/auth' },
    { id: 'ent-rbac', title: 'RBAC & Permissions', route: '/enterprise/rbac' },
    { id: 'ent-org', title: 'Org Administration', route: '/enterprise/org' },
    { id: 'ent-db', title: 'Database Setup', route: '/enterprise/database' },
    { id: 'ent-storage', title: 'Storage', route: '/enterprise/storage' },
    { id: 'ent-models', title: 'Verified Models', route: '/enterprise/verified-models' },
    { id: 'ent-maint', title: 'Maintenance', route: '/enterprise/maintenance' },
    { id: 'ent-license', title: 'License', route: '/enterprise/license' },
  ],

  contributing: [
    { id: 'contrib-overview', title: 'Overview', route: '/contributing' },
    { id: 'contrib-dev-setup', title: 'Development Setup', route: '/contributing/dev-setup' },
    { id: 'contrib-frontend', title: 'Frontend (React)', route: '/contributing/frontend' },
    { id: 'contrib-backend', title: 'Backend (Python)', route: '/contributing/backend' },
    { id: 'contrib-app-server', title: 'App Server', route: '/contributing/app-server' },
    { id: 'contrib-testing', title: 'Testing', route: '/contributing/testing' },
    { id: 'contrib-pr', title: 'PR Process', route: '/contributing/pr-process' },
    { id: 'contrib-eval', title: 'Evaluation & Benchmarks', route: '/contributing/evaluation' },
    { id: 'contrib-docs', title: 'Documentation Style', route: '/contributing/docs-style' },
    { id: 'contrib-maintainers', title: 'Becoming a Maintainer', route: '/contributing/maintainers' },
  ],

  changelog: [
    { id: 'changelog-notes', title: 'Release Notes', route: '/changelog' },
    { id: 'changelog-migration', title: 'Migration Guides', route: '/changelog/migration' },
  ],
};
