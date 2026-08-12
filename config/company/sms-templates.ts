export const smsTemplates = {
  hearingReminder: (input: {
    clientName: string;
    caseLabel: string;
    hearingDateIst: string;
    courtName: string;
  }) =>
    `Dear ${input.clientName}, hearing for ${input.caseLabel} is on ${input.hearingDateIst} at ${input.courtName}. — Manitham Law Foundation`,
} as const;
