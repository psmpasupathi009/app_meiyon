export const compliance = {
  /** Aadhaar: store last-4 only when collected. Never store full Aadhaar. */
  aadhaarLast4Pattern: /^\d{4}$/,
  /** Client intake — fields required for office register / SMS */
  clientIntake: {
    required: ["name", "mobile"] as const,
    recommended: [
      "fatherOrSpouse",
      "address",
      "city",
      "district",
      "state",
      "matterBrief",
    ] as const,
  },
  uploads: {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ] as const,
  },
  csv: {
    maxRows: 500,
    chunkSize: 50,
  },
} as const;
