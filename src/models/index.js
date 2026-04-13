/**
 * @typedef {'not_introduced'|'introduced'|'developing'|'mastered'|'retained'} SkillStatus
 * @typedef {'none'|'low'|'moderate'|'high'|'critical'} ReviewPressure
 * @typedef {'modeled'|'guided'|'supported'|'independent'|'advanced'} SupportLevel
 * @typedef {'tap_select'|'drag_drop'|'tile_build'|'speech_single_word'} InteractionModality
 *
 * @typedef {Object} SkillState
 * @property {string} conceptSlug
 * @property {'foundational'|'oral_language'} strand
 * @property {boolean} taught
 * @property {SkillStatus} recognitionStatus
 * @property {SkillStatus|null} recallStatus
 * @property {ReviewPressure} reviewPressure
 * @property {string|null} lastPracticed
 * @property {string|null} lastAssessed
 * @property {SupportLevel} currentSupportLevel
 *
 * @typedef {Object} ResponseEvent
 * @property {string} id
 * @property {string} timestamp
 * @property {string} sessionId
 * @property {string|null} lessonRunId
 * @property {string|null} activityRunId
 * @property {string|null} stepId
 * @property {string} itemId
 * @property {string[]} conceptSlugs
 * @property {InteractionModality} modality
 * @property {any} response
 * @property {boolean|null} correct
 * @property {number} confidence
 * @property {SupportLevel} supportLevel
 * @property {number|null} responseLatencyMs
 * @property {number} attemptNumber
 * @property {boolean} wasRetryAfterPrompt
 *
 * @typedef {Object} LessonRun
 * @property {string} id
 * @property {string} lessonId
 * @property {string} studentId
 * @property {string} sessionId
 * @property {string} startedAt
 * @property {string|null} completedAt
 * @property {number} currentStep
 * @property {ResponseEvent[]} responseEvents
 */
