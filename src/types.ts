export interface QuotaParams {
  remaining: number;
  entitlement: number;
  percentRemaining: number;
  unlimited: boolean;
  resetDate: string;
  daysRemaining: number;
}
