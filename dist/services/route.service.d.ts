import { RouteResult } from '../types';
export declare class RouteService {
    /**
     * Calculate route from one gate to another.
     */
    static calculateRoute(currentGateId: string, targetGateId: string): Promise<RouteResult | {
        error: string;
    }>;
}
//# sourceMappingURL=route.service.d.ts.map