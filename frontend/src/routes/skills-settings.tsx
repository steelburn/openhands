import React from "react";
import { useTranslation } from "react-i18next";
import { useSaveSettings } from "#/hooks/mutation/use-save-settings";
import { useSettings } from "#/hooks/query/use-settings";
import { useSkills } from "#/hooks/query/use-skills";
import { BrandButton } from "#/components/features/settings/brand-button";
import { I18nKey } from "#/i18n/declaration";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { retrieveAxiosErrorMessage } from "#/utils/retrieve-axios-error-message";
import { SkillCard } from "#/components/features/settings/skills-settings/skill-card";
import { SkillCardSkeleton } from "#/components/features/settings/skills-settings/skill-card-skeleton";

function SkillsSettingsScreen() {
  const { t } = useTranslation();

  const { mutate: saveSettings, isPending } = useSaveSettings();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: skills, isLoading: skillsLoading } = useSkills();

  // Local state: set of skill names the user has toggled off
  const [disabledSet, setDisabledSet] = React.useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = React.useState(false);

  // Sync local state with server settings when data first arrives
  React.useEffect(() => {
    if (settings?.disabled_skills) {
      setDisabledSet(new Set(settings.disabled_skills));
    }
  }, [settings?.disabled_skills]);

  const handleToggle = (skillName: string, enabled: boolean) => {
    setDisabledSet((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.delete(skillName);
      } else {
        next.add(skillName);
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    saveSettings(
      { disabled_skills: Array.from(disabledSet) },
      {
        onSuccess: () => {
          displaySuccessToast(t(I18nKey.SETTINGS$SAVED));
          setHasChanges(false);
        },
        onError: (error) => {
          const errorMessage = retrieveAxiosErrorMessage(error);
          displayErrorToast(errorMessage || t(I18nKey.ERROR$GENERIC));
        },
      },
    );
  };

  const isLoading = settingsLoading || skillsLoading || !settings;

  // Group skills by source
  const groupedSkills = React.useMemo(() => {
    if (!skills) return { public: [], user: [], organization: [] };
    
    const groups = {
      public: [] as typeof skills,
      user: [] as typeof skills,
      organization: [] as typeof skills,
    };

    skills.forEach((skill) => {
      const source = skill.source.toLowerCase();
      if (source === "public") {
        groups.public.push(skill);
      } else if (source === "user") {
        groups.user.push(skill);
      } else {
        groups.organization.push(skill);
      }
    });

    return groups;
  }, [skills]);

  return (
    <div data-testid="skills-settings-screen" className="flex flex-col h-full">
      <div className="mb-6">
        <p className="text-xs text-content-secondary">
          {t(I18nKey.SETTINGS$SKILLS_DESCRIPTION)}
        </p>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar-always">
        {isLoading && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <SkillCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && skills && skills.length > 0 && (
          <div className="flex flex-col gap-8">
            {/* Public Skills Section */}
            {groupedSkills.public.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-content-secondary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  {t(I18nKey.SETTINGS$SKILLS_PUBLIC_SECTION)}
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-tertiary/50 text-content-secondary">
                    {groupedSkills.public.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {groupedSkills.public.map((skill) => (
                    <SkillCard
                      key={skill.name}
                      name={skill.name}
                      type={skill.type}
                      source={skill.source}
                      triggers={skill.triggers}
                      isEnabled={!disabledSet.has(skill.name)}
                      onToggle={(enabled) => handleToggle(skill.name, enabled)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* User Skills Section */}
            {groupedSkills.user.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-content-secondary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {t(I18nKey.SETTINGS$SKILLS_USER_SECTION)}
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-tertiary/50 text-content-secondary">
                    {groupedSkills.user.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {groupedSkills.user.map((skill) => (
                    <SkillCard
                      key={skill.name}
                      name={skill.name}
                      type={skill.type}
                      source={skill.source}
                      triggers={skill.triggers}
                      isEnabled={!disabledSet.has(skill.name)}
                      onToggle={(enabled) => handleToggle(skill.name, enabled)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Organization Skills Section */}
            {groupedSkills.organization.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-content-secondary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {t(I18nKey.SETTINGS$SKILLS_ORG_SECTION)}
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-tertiary/50 text-content-secondary">
                    {groupedSkills.organization.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {groupedSkills.organization.map((skill) => (
                    <SkillCard
                      key={skill.name}
                      name={skill.name}
                      type={skill.type}
                      source={skill.source}
                      triggers={skill.triggers}
                      isEnabled={!disabledSet.has(skill.name)}
                      onToggle={(enabled) => handleToggle(skill.name, enabled)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {!isLoading && (!skills || skills.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-primary/60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <p className="text-sm text-content-secondary">
              {t(I18nKey.SETTINGS$SKILLS_NO_SKILLS)}
            </p>
            <p className="text-xs text-content-tertiary mt-2 max-w-xs">
              {t(I18nKey.SETTINGS$SKILLS_EMPTY_HINT)}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-6 p-6 justify-end border-t border-tertiary/50 mt-4">
        <BrandButton
          testId="skills-save-button"
          variant="primary"
          type="button"
          isDisabled={isPending || !hasChanges}
          onClick={handleSave}
        >
          {!isPending && t(I18nKey.SETTINGS$SAVE_CHANGES)}
          {isPending && t(I18nKey.SETTINGS$SAVING)}
        </BrandButton>
      </div>
    </div>
  );
}

export default SkillsSettingsScreen;
