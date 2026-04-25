import React from "react";
import { useTranslation } from "react-i18next";
import { useUnifiedResumeConversationSandbox } from "#/hooks/mutation/use-unified-start-conversation";
import { useUserProviders } from "#/hooks/use-user-providers";
import { useVisibilityChange } from "#/hooks/use-visibility-change";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { I18nKey } from "#/i18n/declaration";
import { V1SandboxStatus } from "#/api/sandbox-service/sandbox-service.types";
import { V1AppConversation } from "#/api/conversation-service/v1-conversation-service.types";

interface UseSandboxRecoveryOptions {
  conversationId: string | undefined;
  sandboxStatus: V1SandboxStatus | undefined;
  refetchConversation?: () => Promise<{
    data: V1AppConversation | null | undefined;
  }>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useSandboxRecovery({
  conversationId,
  sandboxStatus,
  refetchConversation,
  onSuccess,
  onError,
}: UseSandboxRecoveryOptions) {
  const { t } = useTranslation();
  const { providers } = useUserProviders();
  const { mutate: resumeSandbox, isPending: isResuming } =
    useUnifiedResumeConversationSandbox();

  const processedConversationIdRef = React.useRef<string | null>(null);

  const attemptRecovery = React.useCallback(
    (statusOverride?: V1SandboxStatus) => {
      const status = statusOverride ?? sandboxStatus;
      if (!conversationId || status !== "PAUSED" || isResuming) {
        return;
      }

      resumeSandbox(
        { conversationId, providers },
        {
          onSuccess: () => {
            onSuccess?.();
          },
          onError: (error) => {
            displayErrorToast(
              t(I18nKey.CONVERSATION$FAILED_TO_START_WITH_ERROR, {
                error: error.message,
              }),
            );
            onError?.(error);
          },
        },
      );
    },
    [
      conversationId,
      sandboxStatus,
      isResuming,
      providers,
      resumeSandbox,
      onSuccess,
      onError,
      t,
    ],
  );

  React.useEffect(() => {
    if (!conversationId || !sandboxStatus) return;
    if (processedConversationIdRef.current === conversationId) return;

    processedConversationIdRef.current = conversationId;

    if (sandboxStatus === "PAUSED") {
      attemptRecovery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, sandboxStatus]);

  const handleVisible = React.useCallback(async () => {
    if (!conversationId || !refetchConversation) return;

    try {
      const { data } = await refetchConversation();
      attemptRecovery(data?.sandbox_status);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        "Failed to refetch conversation on visibility change:",
        error,
      );
    }
  }, [conversationId, refetchConversation, isResuming, attemptRecovery]);

  useVisibilityChange({
    enabled: !!conversationId,
    onVisible: handleVisible,
  });

  return { isResuming };
}
