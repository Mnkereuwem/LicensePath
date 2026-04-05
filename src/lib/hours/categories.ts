export const HOUR_CATEGORY_KEYS = [
  "direct_clinical",
  "face_to_face",
  "non_clinical",
  "individual_supervision",
  "group_supervision",
  "other",
] as const;

export type HourCategoryKey = (typeof HOUR_CATEGORY_KEYS)[number];

export const HOUR_FIELD_GROUPS: {
  legend: string;
  description?: string;
  keys: { key: HourCategoryKey; label: string; hint?: string }[];
}[] = [
  {
    legend: "Direct clinical (client contact)",
    description:
      "Face-to-face counts toward the 750h subset; other direct counts toward the 2,000h clinical minimum.",
    keys: [
      {
        key: "face_to_face",
        label: "Face-to-face clinical",
        hint: "Counts toward 750h face-to-face requirement",
      },
      {
        key: "direct_clinical",
        label: "Other direct clinical",
        hint: "Non–face-to-face direct clinical hours",
      },
    ],
  },
  {
    legend: "Supervision",
    keys: [
      { key: "individual_supervision", label: "Individual supervision" },
      { key: "group_supervision", label: "Group supervision" },
    ],
  },
  {
    legend: "Other experience",
    keys: [
      {
        key: "non_clinical",
        label: "Non-clinical (max 1,000)",
        hint: "Admin, trainings, case conferences per board rules",
      },
      { key: "other", label: "Other credited", hint: "Use notes if category is unclear" },
    ],
  },
];

export function emptyHourRecord(): Record<HourCategoryKey, number> {
  return {
    direct_clinical: 0,
    face_to_face: 0,
    non_clinical: 0,
    individual_supervision: 0,
    group_supervision: 0,
    other: 0,
  };
}
