import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AxiosError } from "axios";
import { useNavigate } from "react-router";
import { useSettings } from "#/hooks/query/use-settings";
import { useConfig } from "#/hooks/query/use-config";
import { useSaveSettings } from "#/hooks/mutation/use-save-settings";
import { SettingsDropdownInput } from "#/components/features/settings/settings-dropdown-input";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { BrandButton } from "#/components/features/settings/brand-button";
import { Typography } from "#/ui/typography";
import { I18nKey } from "#/i18n/declaration";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { retrieveAxiosErrorMessage } from "#/utils/retrieve-axios-error-message";
import type { ACPProviderInfo } from "#/api/option-service/option.types";

export const handle = { hideTitle: true };

type AgentType = "openhands" | "acp";

const CUSTOM_PRESET = "custom";

function tokenizeCommand(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/** Match free-text command against the registry; ``"custom"`` if no preset
 *  matches verbatim. */
function detectPreset(text: string, providers: ACPProviderInfo[]): string {
  const trimmed = text.trim();
  for (const p of providers) {
    if (trimmed === p.default_command.join(" ")) return p.key;
  }
  return CUSTOM_PRESET;
}

function AgentSettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSettings();
  const { data: config, isLoading: isConfigLoading } = useConfig();
  const { mutate: saveSettings, isPending: isSaving } = useSaveSettings();

  // SDK registry, served on /api/v1/web-client/config. Empty until the
  // config query resolves; effects below gate on this list being non-empty
  // before deriving presets.
  const acpProviders = useMemo<ACPProviderInfo[]>(
    () => config?.acp_providers ?? [],
    [config?.acp_providers],
  );

  const defaultPresetKey = acpProviders[0]?.key ?? CUSTOM_PRESET;
  const placeholderCommand = acpProviders[0]?.default_command.join(" ") ?? "";

  const [agentType, setAgentType] = useState<AgentType>("openhands");
  const [commandText, setCommandText] = useState("");
  const [selectedPreset, setSelectedPreset] =
    useState<string>(defaultPresetKey);
  const [acpModel, setAcpModel] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const kind = settings.agent_settings?.agent_kind;
    if (kind === "acp") {
      setAgentType("acp");

      const acpCommand = settings.agent_settings?.acp_command ?? [];
      const acpArgs = settings.agent_settings?.acp_args ?? [];
      const joined = [...acpCommand, ...acpArgs].join(" ");
      setCommandText(joined);
      setSelectedPreset(detectPreset(joined, acpProviders));

      setAcpModel(settings.agent_settings?.acp_model ?? "");
    } else {
      setAgentType("openhands");
      setCommandText("");
      setAcpModel("");
    }
    setIsDirty(false);
  }, [settings, acpProviders]);

  const isAcpEnabled = !!config?.feature_flags?.enable_acp;

  useEffect(() => {
    if (config && !isAcpEnabled) {
      navigate("/settings", { replace: true });
    }
  }, [config, isAcpEnabled, navigate]);

  if (isLoading || isConfigLoading || !isAcpEnabled) return null;

  const isAcp = agentType === "acp";
  const commandTokens = tokenizeCommand(commandText);
  const isAcpInvalid = isAcp && commandTokens.length === 0;

  const handleSave = () => {
    let agentSettingsDiff: Record<string, unknown>;
    if (isAcp) {
      // Stamp the selected preset key (or ``"custom"``) so the conversation
      // chip can resolve a brand label, and the backend can rebuild the
      // command from the registry when resuming a built-in preset.
      agentSettingsDiff = {
        agent_kind: "acp",
        acp_server: selectedPreset,
        acp_command: commandTokens,
        acp_args: [],
        acp_model: acpModel.trim() || null,
      };
    } else {
      // The backend's ``saved_agent_configs`` snapshot/restore handles
      // wiping ACP-only fields when switching kinds, so the diff only
      // needs to carry the new kind.
      agentSettingsDiff = { agent_kind: "openhands" };
    }

    saveSettings(
      { agent_settings_diff: agentSettingsDiff },
      {
        onError: (error) => {
          const message = retrieveAxiosErrorMessage(error as AxiosError);
          displayErrorToast(message || t(I18nKey.ERROR$GENERIC));
        },
        onSuccess: () => {
          displaySuccessToast(t(I18nKey.SETTINGS$SAVED));
          setIsDirty(false);
        },
      },
    );
  };

  // Registry presets + the always-present "custom" sentinel.
  const presetItems = [
    ...acpProviders.map((p) => ({ key: p.key, label: p.display_name })),
    { key: CUSTOM_PRESET, label: t(I18nKey.SETTINGS$AGENT_PRESET_CUSTOM) },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-2xl">
      <div>
        <Typography.H2 className="mb-2">
          {t(I18nKey.SETTINGS$AGENT)}
        </Typography.H2>
        <Typography.Paragraph className="text-sm text-[#A3A3A3]">
          {t(I18nKey.SETTINGS$AGENT_PAGE_DESCRIPTION)}
        </Typography.Paragraph>
      </div>

      <SettingsDropdownInput
        testId="agent-type-selector"
        name="agent-type"
        label={t(I18nKey.SETTINGS$AGENT)}
        items={[
          {
            key: "openhands",
            label: t(I18nKey.SETTINGS$AGENT_TYPE_OPENHANDS),
          },
          { key: "acp", label: t(I18nKey.SETTINGS$AGENT_TYPE_ACP) },
        ]}
        selectedKey={agentType}
        onSelectionChange={(key) => {
          if (!key) return;
          const newType = key as AgentType;
          setAgentType(newType);
          if (newType === "acp" && !commandText) {
            const preset =
              acpProviders.find((p) => p.key === selectedPreset) ??
              acpProviders[0];
            if (preset) {
              setSelectedPreset(preset.key);
              setCommandText(preset.default_command.join(" "));
            }
          }
          setIsDirty(true);
        }}
      />

      {isAcp && (
        <>
          <SettingsDropdownInput
            testId="agent-preset-selector"
            name="agent-preset"
            label={t(I18nKey.SETTINGS$AGENT_PRESET)}
            items={presetItems}
            selectedKey={selectedPreset}
            onSelectionChange={(key) => {
              if (!key) return;
              const preset = String(key);
              setSelectedPreset(preset);
              const provider = acpProviders.find((p) => p.key === preset);
              if (provider) {
                setCommandText(provider.default_command.join(" "));
              }
              setIsDirty(true);
            }}
          />

          <div className="flex flex-col gap-2.5">
            <Typography.Text className="text-sm">
              {t(I18nKey.SETTINGS$MCP_COMMAND)}
            </Typography.Text>
            <textarea
              data-testid="agent-command-input"
              className="bg-tertiary border border-[#717888] rounded-sm p-2 text-sm font-mono text-white placeholder:italic placeholder:text-[#717888] min-h-[60px] resize-y focus:outline-none focus:border-white"
              value={commandText}
              placeholder={placeholderCommand}
              onChange={(e) => {
                const text = e.target.value;
                setCommandText(text);
                setSelectedPreset(detectPreset(text, acpProviders));
                setIsDirty(true);
              }}
            />
            <Typography.Text className="text-xs text-[#717888]">
              {t(I18nKey.SETTINGS$AGENT_COMMAND_HINT)}
            </Typography.Text>
          </div>

          <div className="flex flex-col gap-1.5">
            <SettingsInput
              testId="agent-model-input"
              label={t(I18nKey.SCHEMA$LLM$MODEL$LABEL)}
              type="text"
              className="w-full"
              value={acpModel}
              showOptionalTag
              onChange={(value) => {
                setAcpModel(value);
                setIsDirty(true);
              }}
            />
            <Typography.Text className="text-xs text-[#717888]">
              {t(I18nKey.SETTINGS$AGENT_MODEL_HINT)}
            </Typography.Text>
          </div>
        </>
      )}

      <div>
        <BrandButton
          testId="agent-save-button"
          type="button"
          variant="primary"
          isDisabled={isSaving || !isDirty || isAcpInvalid}
          onClick={handleSave}
        >
          {isSaving ? t(I18nKey.SETTINGS$SAVING) : t(I18nKey.BUTTON$SAVE)}
        </BrandButton>
      </div>
    </div>
  );
}

export default AgentSettingsScreen;
