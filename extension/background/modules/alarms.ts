import { ALARM_CLASSIFY_UPS, ALARM_UPDATE_UP_LIST, type AlarmLike, type AlarmManager, type BackgroundOptions } from "./common-types.js";
import { classifyUpTask } from "./classify-api.js";
import { updateUpListTask } from "./up-list.js";

export function scheduleAlarms(alarms: AlarmManager): void {
  console.log("[Background] Schedule alarms");
  alarms.create(ALARM_UPDATE_UP_LIST, { periodInMinutes: 24 * 60 });
  alarms.create(ALARM_CLASSIFY_UPS, { periodInMinutes: 7 * 24 * 60 });
}

export async function handleAlarm(
  alarm: AlarmLike,
  options: BackgroundOptions = {}
): Promise<void> {
  if (alarm.name === ALARM_UPDATE_UP_LIST) {
    await updateUpListTask(options);
    return;
  }
  if (alarm.name === ALARM_CLASSIFY_UPS) {
    await classifyUpTask(options);
  }
}
