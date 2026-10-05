export const deviceCheckKey = (id: string) =>
  `lembra-data:reminder-check:${id}`;
export function reminderConfirmed(id: string) {
  try {
    return !!localStorage.getItem(deviceCheckKey(id));
  } catch {
    return false;
  }
}
