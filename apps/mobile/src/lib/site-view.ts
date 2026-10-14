// Android and iOS apps don't switch between the member app and the admin site:
// gym staff use the front-desk screens in the app. See site-view.web.ts.
export const openAdmin: (() => void) | null = null;
export function useLandOnAdmin(_isTeam: boolean, _enabled: boolean) {}
