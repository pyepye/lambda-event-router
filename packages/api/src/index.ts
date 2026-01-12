import { eventLog } from "@lambda-event-router/base";

export function apiLog(): void {
  eventLog();
  console.log("API");
}
