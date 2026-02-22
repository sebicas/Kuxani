/**
 * Socket.IO Event Constants
 *
 * Shared between server and client to avoid magic strings.
 */
export const PARTNER_JOINED = "partner-joined";
export const CHALLENGE_UPDATED = "challenge-updated";
export const GRATITUDE_UPDATED = "gratitude-updated";
export const MOOD_UPDATED = "mood-updated";
export const LOVE_LANGUAGE_UPDATED = "love-language-updated";
export const ATTACHMENT_STYLE_UPDATED = "attachment-style-updated";
export const CHILDHOOD_WOUNDS_UPDATED = "childhood-wounds-updated";

/* ── Disagreement events ── */
export const DISAGREEMENT_MESSAGE = "disagreement-message";
export const DISAGREEMENT_STATUS = "disagreement-status";
export const DISAGREEMENT_TYPING = "disagreement-typing";
export const DISAGREEMENT_INVITE = "disagreement-invite";
export const DISAGREEMENT_INVITE_RESPONSE = "disagreement-invite-response";

/* ── Partner activity states (always visible in UX) ── */
export const PARTNER_ACTIVITY = "partner-activity";
// Payload: { disagreementId, userId, activity: PartnerActivity }
// PartnerActivity: "idle" | "viewing_list" | "reading_invite" |
//   "reading_perspective" | "writing_perspective" | "typing" |
//   "speaking" | "online" | "offline"

/* ── Requests & Compromises events ── */
export const REQUEST_CREATED = "request-created";
export const REQUEST_UPDATED = "request-updated";
export const COMPROMISE_CREATED = "compromise-created";
export const COMPROMISE_UPDATED = "compromise-updated";

/* ── Intake events ── */
export const INTAKE_UPDATED = "intake-updated";

