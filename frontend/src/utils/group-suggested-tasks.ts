import { SuggestedTask, SuggestedTaskGroup } from "#/utils/types";

export function groupSuggestedTasks(
  tasks: SuggestedTask[],
): SuggestedTaskGroup[] {
  const groupsMap: Record<string, SuggestedTaskGroup> = {};

  for (const task of tasks) {
    const groupKey = `${task.repo}`;

    if (!groupsMap[groupKey]) {
      groupsMap[groupKey] = {
        title: groupKey,
        tasks: [],
      };
    }

    groupsMap[groupKey].tasks.push(task);
  }

  return Object.values(groupsMap);
}
