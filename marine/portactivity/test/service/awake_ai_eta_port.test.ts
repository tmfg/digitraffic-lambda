import * as sinon from "sinon";
import {AwakeAiETAPortService} from "../../lib/service/awake_ai_eta_port";
import {AwakeAiPortApi, AwakeAiPortResponse, AwakeAiPortResponseType,} from "../../lib/api/awake_ai_port";
import {randomIMO, randomMMSI} from "../testdata";
import {
    AwakeAiPrediction,
    AwakeAiPredictionMetadata,
    AwakeAiPredictionType,
    AwakeAiShipStatus,
    AwakeAiVoyageEtaPrediction,
    AwakeAiZoneType,
} from "../../lib/api/awake_common";
import {getRandomNumber, randomBoolean,} from "@digitraffic/common/dist/test/testutils";
import {addHours, subHours} from "date-fns";

describe("AwakeAiETAPortService(", () => {
    test("getAwakeAiTimestamps - correct needs to include port call prediction", async () => {
        const api = createApi();
        const service = new AwakeAiETAPortService(api);
        sinon
            .stub(api, "getETAs")
            .returns(
                Promise.resolve(
                    createResponse({includePortCallPrediction: true})
                )
            );

        const timestamps = await service.getAwakeAiTimestamps("FILOL");

        expect(timestamps.length).toBe(1);
    });

    test("getAwakeAiTimestamps - no schedule", async () => {
        const api = createApi();
        const service = new AwakeAiETAPortService(api);
        const voyageTimestamp = createResponse({
            excludeSchedule: true,
            includePortCallPrediction: true
        });

        sinon.stub(api, "getETAs").returns(Promise.resolve(voyageTimestamp));

        const timestamps = await service.getAwakeAiTimestamps("FILOL");

        expect(timestamps.length).toBe(0);
    });

    test("getAwakeAiTimestamps - filter stopped voyages", async () => {
        const api = createApi();
        const service = new AwakeAiETAPortService(api);
        const voyageTimestamp = createResponse({
            voyageStatus: AwakeAiShipStatus.STOPPED,
            includePortCallPrediction: true
        });
        sinon.stub(api, "getETAs").returns(Promise.resolve(voyageTimestamp));

        const timestamps = await service.getAwakeAiTimestamps("FILOL");

        expect(timestamps.length).toBe(0);
    });

    test("getAwakeAiTimestamps - non-ETA", async () => {
        const api = createApi();
        const service = new AwakeAiETAPortService(api);
        const voyageTimestamp = createResponse({
            predictionType: randomBoolean()
                ? AwakeAiPredictionType.TRAVEL_TIME
                : AwakeAiPredictionType.DESTINATION,
        });
        sinon.stub(api, "getETAs").returns(Promise.resolve(voyageTimestamp));

        const timestamps = await service.getAwakeAiTimestamps("FILOL");

        expect(timestamps.length).toBe(0);
    });

    test("getAwakeAiTimestamps - 24 hours or closer", async () => {
        const api = createApi();
        const service = new AwakeAiETAPortService(api);
        const voyageTimestamp = createResponse({
            arrivalTime: subHours(new Date(), getRandomNumber(1, 23)),
            voyageStatus: AwakeAiShipStatus.UNDER_WAY,
            predictionType: AwakeAiPredictionType.ETA,
            includePortCallPrediction: true,
        });
        sinon.stub(api, "getETAs").returns(Promise.resolve(voyageTimestamp));

        const timestamps = await service.getAwakeAiTimestamps("FILOL");

        expect(timestamps.length).toBe(0);
    });

    test("getAwakeAiTimestamps - filter Digitraffic ETA predictions", async () => {
        const api = createApi();
        const service = new AwakeAiETAPortService(api);
        const voyageTimestamp = createResponse({
            voyageStatus: AwakeAiShipStatus.UNDER_WAY,
            predictionType: AwakeAiPredictionType.ETA,
            includePortCallPrediction: true,
            metadata: {
                source: "urn:awake:digitraffic-portcall:2959158",
            },
        });
        sinon.stub(api, "getETAs").returns(Promise.resolve(voyageTimestamp));

        const timestamps = await service.getAwakeAiTimestamps("FILOL");

        expect(timestamps.length).toBe(0);
    });
});

function createApi() {
    return new AwakeAiPortApi("", "");
}

function createResponse(options?: {
    arrivalTime?: Date;
    voyageStatus?: AwakeAiShipStatus;
    predictionType?: AwakeAiPredictionType;
    includePortCallPrediction?: boolean;
    excludeSchedule?: boolean;
    metadata?: AwakeAiPredictionMetadata;
}): AwakeAiPortResponse {
    const predictions: AwakeAiPrediction[] = [
        {
            predictionType:
                options?.predictionType ?? AwakeAiPredictionType.ETA,
            locode: "FILOL",
            zoneType: AwakeAiZoneType.BERTH,
            recordTime: new Date().toISOString(),
            arrivalTime:
                options?.arrivalTime?.toISOString() ?? addHours(new Date, 25).toISOString(),
            metadata: options?.metadata
        } as AwakeAiVoyageEtaPrediction,
    ];
    return {
        type: AwakeAiPortResponseType.OK,
        ...(!options?.excludeSchedule &&
            {
                schedule: [
                    {
                        ship: {
                            imo: randomIMO(),
                            mmsi: randomMMSI(),
                        },
                        voyage: {
                            voyageStatus:
                                options?.voyageStatus ?? AwakeAiShipStatus.UNDER_WAY,
                            predictions: options?.includePortCallPrediction
                                ? predictions.concat([
                                    {
                                        predictionType:
                                        AwakeAiPredictionType.ARRIVAL_PORT_CALL,
                                    },
                                ])
                                : predictions,
                            sequenceNo: 1,
                        },
                    },
                ]
            }),
    };
}
