export const smsTemplates = {
  hearingReminder: (input: {
    clientName: string;
    caseLabel: string;
    hearingDateIst: string;
    courtName: string;
    officeName: string;
  }) =>
    `Dear ${input.clientName}, hearing for ${input.caseLabel} is on ${input.hearingDateIst} at ${input.courtName}. — ${input.officeName}`,
} as const;
