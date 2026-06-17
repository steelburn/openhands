import React from "react";
import { useTranslation } from "react-i18next";
import { SkillCard } from "./skill-card";
import { SkillCardSkeleton } from "./skill-card-skeleton";
import { SkillInfo } from "#/types/settings";

interface SkillListProps {
  skills: SkillInfo[];
  enabledSkills: Set<string>;
  onToggle: (skillName: string, enabled: boolean) => void;
  isLoading?: boolean;
  filterSource?: "all" | "public" | "user" | "organization";
  filterType?: "all" | "microagent" | "assistant";
}

export function SkillList({
  skills,
  enabledSkills,
  onToggle,
  isLoading = false,
  filterSource = "all",
  filterType = "all",
}: SkillListProps) {
  const { t } = useTranslation();

  const filteredSkills = React.useMemo(() => {
    return skills.filter((skill) => {
      const sourceMatch =
        filterSource === "all" ||
        skill.source.toLowerCase() === filterSource.toLowerCase();
      const typeMatch =
        filterType === "all" ||
        skill.type.toLowerCase() === filterType.toLowerCase();
      return sourceMatch && typeMatch;
    });
  }, [skills, filterSource, filterType]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <SkillCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (filteredSkills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-tertiary/30 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-content-tertiary"
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
        <p className="text-xs text-content-tertiary mt-1">
          {t(I18nKey.SETTINGS$SKILLS_EMPTY_HINT)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {filteredSkills.map((skill) => (
        <SkillCard
          key={skill.name}
          name={skill.name}
          type={skill.type}
          source={skill.source}
          triggers={skill.triggers}
          isEnabled={!enabledSkills.has(skill.name)}
          onToggle={(enabled) => onToggle(skill.name, enabled)}
        />
      ))}
    </div>
  );
}

interface SkillCategorySectionProps {
  title: string;
  skills: SkillInfo[];
  enabledSkills: Set<string>;
  onToggle: (skillName: string, enabled: boolean) => void;
  isLoading?: boolean;
  count?: number;
}

export function SkillCategorySection({
  title,
  skills,
  enabledSkills,
  onToggle,
  isLoading = false,
  count,
}: SkillCategorySectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {!isLoading && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-tertiary/50 text-content-secondary">
            {count ?? skills.length}
          </span>
        )}
      </div>
      <SkillList
        skills={skills}
        enabledSkills={enabledSkills}
        onToggle={onToggle}
        isLoading={isLoading}
      />
    </div>
  );
}
