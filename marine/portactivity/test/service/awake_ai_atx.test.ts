import {newAwakeATXMessage, someNumber} from "../testdata";
import * as sinon from 'sinon';
import {AwakeAiATXApi, AwakeAIATXTimestampMessage, AwakeATXZoneEventType} from "../../lib/api/awake_ai_atx";
import {AwakeAiATXService} from "../../lib/service/awake_ai_atx";
import {dbTestBase, insertPortAreaDetails, insertPortCall} from "../db-testutil";
import * as pgPromise from "pg-promise";
import {ApiTimestamp, EventType} from "../../lib/model/timestamp";
import {randomBoolean} from "digitraffic-common/test/testutils";
import {EventSource} from "../../lib/model/eventsource";
const ws = require('ws');

describe('service Awake.AI ATx', dbTestBase((db: pgPromise.IDatabase<any, any>) => {

    test('getATXs - no portcall found for ATx', async () => {
        const atxMessage = newAwakeATXMessage();
        const api = new AwakeAiATXApi('', '', ws);
        sinon.stub(api, 'getATXs').returns(Promise.resolve([atxMessage]));
        const service = new AwakeAiATXService(api);

        const timestamps = await service.getATXs([atxMessage.locodes[0]], 0); // timeout is irrelevant

        expect(timestamps.length).toBe(0);
    });

    test('getATXs - ATx with portcall', async () => {
        const zoneEventType = randomBoolean() ? AwakeATXZoneEventType.ARRIVAL : AwakeATXZoneEventType.DEPARTURE;
        const atxMessage = newAwakeATXMessage(zoneEventType);
        const portcallId = 1;
        await createPortcall(atxMessage, portcallId);
        const api = new AwakeAiATXApi('', '', ws);
        sinon.stub(api, 'getATXs').returns(Promise.resolve([atxMessage]));
        const service = new AwakeAiATXService(api);

        const timestamps = await service.getATXs([atxMessage.locodes[0]], 0); // timeout is irrelevant

        expect(timestamps.length).toBe(1);
        const expectedTimestamp: ApiTimestamp = {
            eventType: zoneEventType === AwakeATXZoneEventType.ARRIVAL ? EventType.ATA : EventType.ATD,
            eventTime: atxMessage.eventTimestamp,
            recordTime: atxMessage.eventTimestamp,
            location: {
                port: atxMessage.locodes[0]
            },
            ship: {
                mmsi: atxMessage.mmsi,
                imo: atxMessage.imo
            },
            source: EventSource.AWAKE_AI
        };
        expect(timestamps[0]).toMatchObject(expectedTimestamp);
    });

    async function createPortcall(atxMessage: AwakeAIATXTimestampMessage, portcallId: number) {
        return db.tx(t => {
            insertPortCall(t, {
                port_call_id: portcallId,
                radio_call_sign: 'a',
                radio_call_sign_type: 'fake',
                vessel_name: atxMessage.shipName,
                port_call_timestamp: new Date(),
                port_to_visit: atxMessage.locodes[0],
                mmsi: atxMessage.mmsi,
                imo_lloyds: atxMessage.imo
            });
            insertPortAreaDetails(t, {
                port_call_id: portcallId,
                port_area_details_id: someNumber(),
                eta: new Date().toISOString()
            });
        });
    }

}));