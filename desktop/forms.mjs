export const FORMS = [
  { title: "常态", x: "0%", y: "0%", color: "#f5cf77" },
  { title: "二档", x: "50%", y: "0%", color: "#ffa58f" },
  { title: "三档", x: "100%", y: "0%", color: "#f2c396" },
  { title: "四档", x: "0%", y: "100%", color: "#ee9aba" },
  { title: "五档", x: "50%", y: "100%", color: "#e4d9ff" },
];

export const EFFORT_FORMS = [
  ...FORMS,
  { title: "黑色猴子", x: "100%", y: "100%", color: "#ae9dff" },
];

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max", "ultra"];

export const EFFORTS = {
  none: { label: "无", form: 0 },
  minimal: { label: "最低", form: 0 },
  low: { label: "低", form: 0 },
  medium: { label: "中", form: 1 },
  high: { label: "高", form: 2 },
  xhigh: { label: "更高", form: 3 },
  max: { label: "最高", form: 4 },
  ultra: { label: "极高", form: 5 },
};

