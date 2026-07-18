import { NudgeRecord } from '../types';
export declare class NudgeService {
    /**
     * Generate a nudge recommendation for a fan.
     */
    static generateNudge(userId: string, currentGateId: string, userLat: number, userLng: number): Promise<NudgeRecord | {
        error: string;
    }>;
}
//# sourceMappingURL=nudge.service.d.ts.map