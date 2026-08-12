/**
 * Default advocate booking windows (IST) when an advocate has not saved hours yet.
 * Once they save hours (even all closed), their rows replace these defaults.
 */

export type WeeklyHourRange = {
  weekday: number;
  startTime: string;
  endTime: string;
};

export const bookingDefaults = {
  timezone: "Asia/Kolkata",
  slotStepMin: 15,
  workStart: "09:30",
  workEnd: "18:00",
  breakStart: "13:00",
  breakEnd: "14:00",
  /** 0=Sun … 6=Sat — default open Mon–Sat */
  defaultOpenWeekdays: [1, 2, 3, 4, 5, 6],
  weeklyHours: [
    { weekday: 1, startTime: "09:30", endTime: "13:00" },
    { weekday: 1, startTime: "14:00", endTime: "18:00" },
    { weekday: 2, startTime: "09:30", endTime: "13:00" },
    { weekday: 2, startTime: "14:00", endTime: "18:00" },
    { weekday: 3, startTime: "09:30", endTime: "13:00" },
    { weekday: 3, startTime: "14:00", endTime: "18:00" },
    { weekday: 4, startTime: "09:30", endTime: "13:00" },
    { weekday: 4, startTime: "14:00", endTime: "18:00" },
    { weekday: 5, startTime: "09:30", endTime: "13:00" },
    { weekday: 5, startTime: "14:00", endTime: "18:00" },
    { weekday: 6, startTime: "09:30", endTime: "13:00" },
    { weekday: 6, startTime: "14:00", endTime: "18:00" },
  ] as WeeklyHourRange[],
};

/** Build morning+afternoon ranges from work hours + one shared break. */
export function rangesFromWorkAndBreak(input: {
  workStart: string;
  workEnd: string;
  breakStart?: string;
  breakEnd?: string;
}): { startTime: string; endTime: string }[] {
  const { workStart, workEnd, breakStart, breakEnd } = input;
  if (!breakStart || !breakEnd || breakStart >= breakEnd) {
    return [{ startTime: workStart, endTime: workEnd }];
  }
  if (breakStart <= workStart || breakEnd >= workEnd) {
    return [{ startTime: workStart, endTime: workEnd }];
  }
  return [
    { startTime: workStart, endTime: breakStart },
    { startTime: breakEnd, endTime: workEnd },
  ];
}
