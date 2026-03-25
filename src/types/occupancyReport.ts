export type OccupancyWeek = {
  year: number;
  week: number;
  label: string;
};

export type OccupancyDataPoint = {
  capacity: number;
  overheadHours: number;
  hoursRaw: number;
  hoursWeighted: number;
  customer100Hours: number;
  leadsHours: number;
  internalHours: number;
  absenceHours: number;
  occupancyExkl: number;
  occupancyInkl: number;
};

export type OccupancyReportResult = {
  weeks: OccupancyWeek[];
  points: OccupancyDataPoint[];
};

export type RoleOccupancyRow = {
  roleId: string;
  roleName: string;
  weeks: OccupancyWeek[];
  points: OccupancyDataPoint[];
};
