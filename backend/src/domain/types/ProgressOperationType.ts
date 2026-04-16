export const PROGRESS_OPERATION_TYPES = [
  'complete_lesson',
  'complete_activity',
  'complete_connected_text',
  'set_selected_friend',
  'replace_skill_state'
] as const;

export type ProgressOperationType = (typeof PROGRESS_OPERATION_TYPES)[number];
