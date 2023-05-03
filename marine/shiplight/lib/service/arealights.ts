import { AreaLightsApi } from "../api/arealights";
import { AreaTraffic } from "../model/areatraffic";
import { retry, RetryLogError } from "@digitraffic/common/dist/utils/retry";
import { logger } from "@digitraffic/common/dist/aws/runtime/dt-logger-default";

export class AreaLightsService {
    private readonly api: AreaLightsApi;

    constructor(api: AreaLightsApi) {
        this.api = api;
    }

    /**
     * Updates visibility for lights in an area.
     * @param areaTraffic
     */
    async updateLightsForArea(areaTraffic: AreaTraffic): Promise<void> {
        const areaId = areaTraffic.areaId;

        logger.info({
            method: "ArealightsService.updateLightsForArea",
            duration: areaTraffic.durationInMinutes,
            visibility: areaTraffic.visibilityInMeters?.toString(),
            mmsi: areaTraffic.ship.mmsi
        });

        await retry(
            async () => {
                const response = await this.api.updateLightsForArea({
                    routeId: areaId,
                    visibility: areaTraffic.visibilityInMeters,
                    time: areaTraffic.durationInMinutes,
                    MMSI: areaTraffic.ship.mmsi.toString(),
                    shipName: areaTraffic.ship.name
                });
                if (response.LightsSetSentFailed.length) {
                    logger.warn({
                        method: "ArealightsService.updateLightsForArea",
                        message: `LightsSetSentFailed : ${response.LightsSetSentFailed.join(", ")}`
                    });
                }
            },
            2,
            RetryLogError.LOG_LAST_RETRY_AS_ERROR_OTHERS_AS_WARNS
        );
    }
}
