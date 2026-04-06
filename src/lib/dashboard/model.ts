export type DashboardHourSnapshot = {
  totalCredited: number;
  directClinicalCredited: number;
  faceToFaceCredited: number;
  nonClinicalCredited: number;
};

export type DashboardWeekSnapshot = {
  clinicalHours: number;
  individualSupervisionHours: number;
  groupSupervisionHours: number;
  rawTotalHours?: number;
};

export type DashboardModel = {
  hours: DashboardHourSnapshot;
  week: DashboardWeekSnapshot;
  cappedWeekTotal: number;
  totalProgressPercent: number;
  sunset: {
    registrationDate: Date;
    endDate: Date;
    daysRemaining: number;
  };
  targets: {
    total: number;
    directMin: number;
    faceToFaceMin: number;
    nonClinicalMax: number;
  };
};
