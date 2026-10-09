// What form-button server actions return: nothing on success, or a message the
// UI shows in a toast (instead of throwing, which would show the error page).
export type ActionResult = { error?: string } | void;
