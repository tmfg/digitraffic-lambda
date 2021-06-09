import {
    momentAverage,
    mergeTimestamps,
    EVENTSOURCE_SCHEDULES_CALCULATED,
    EVENTSOURCE_TEQPLAY, EVENTSOURCE_VTS, EVENTSOURCE_PORTNET, EVENTSOURCE_SCHEDULES_VTS_CONTROL
} from "../lib/event-sourceutil";
import moment from "moment-timezone";
import {newTimestamp} from "./testdata";
import {ApiTimestamp} from "../lib/model/timestamp";
import {shuffle} from "digitraffic-common/js/js-utils";

describe('event-sourceutil', () => {

    test('momentAverage', () => {
        const m1 = moment(1622549546737);
        const m2 = moment(1622549553609);

        const average = momentAverage([m1, m2])

        expect(average).toBe('2021-06-01T12:12:30.173Z');
    });

    test('mergeTimestamps - filters out all but one', () => {
        const portcallId = 1;
        const timestamps = [
            newTimestamp({ source: EVENTSOURCE_SCHEDULES_CALCULATED, portcallId }),
            newTimestamp({ source: EVENTSOURCE_TEQPLAY, portcallId }),
            newTimestamp({ source: EVENTSOURCE_VTS, portcallId })
        ];

        const merged = mergeTimestamps(timestamps);

        expect(merged.length).toBe(1);
    });

    test('mergeTimestamps - doesnt filter other than VTS A', () => {
        const portcallId = 1;
        const timestamps = [
            newTimestamp({ source: EVENTSOURCE_SCHEDULES_CALCULATED, portcallId }),
            newTimestamp({ source: EVENTSOURCE_PORTNET, portcallId }),
            newTimestamp({ source: EVENTSOURCE_VTS, portcallId })
        ];

        const merged = mergeTimestamps(timestamps);

        expect(merged.length).toBe(2);
    });

    test('mergeTimestamps - timestamps are sorted after merge', () => {
        const portcallId = 1;
        const schedulesTimestamp = newTimestamp({ eventTime: new Date(1621623790702), source: EVENTSOURCE_SCHEDULES_CALCULATED, portcallId });
        const vtsTimestamp = newTimestamp({ eventTime: new Date(1620623590702), source: EVENTSOURCE_VTS, portcallId });
        const portnetTimestamp = newTimestamp({ eventTime: new Date(1622623690702), source: EVENTSOURCE_PORTNET, portcallId });
        const vtsControlTimestamp = newTimestamp({ eventTime: new Date(1622623890702), source: EVENTSOURCE_SCHEDULES_VTS_CONTROL, portcallId });

        const timestamps = shuffle([
            vtsControlTimestamp,
            schedulesTimestamp,
            portnetTimestamp,
            vtsTimestamp
        ]);

        const merged = mergeTimestamps(timestamps);

        expect(merged.length).toBe(3);
        expect(merged[0].source).toBe(EVENTSOURCE_SCHEDULES_CALCULATED);
        expect(merged[1].source).toBe(EVENTSOURCE_PORTNET);
        expect(merged[2].source).toBe(EVENTSOURCE_SCHEDULES_VTS_CONTROL);
    });

    test('mergeTimestamps - picks highest priority source', () => {
        const portcallId = 1;
        const schedulesTimestamp = newTimestamp({ source: EVENTSOURCE_SCHEDULES_CALCULATED, portcallId });
        const teqplayTimestamp = newTimestamp({ source: EVENTSOURCE_TEQPLAY, portcallId });
        const vtsTimestamp = newTimestamp({ source: EVENTSOURCE_VTS, portcallId });
        const timestamps = [
            teqplayTimestamp,
            schedulesTimestamp,
            vtsTimestamp
        ];

        const merged = mergeTimestamps(timestamps)[0] as ApiTimestamp;

        expect(merged.portcallId).toBe(schedulesTimestamp.portcallId);
        expect(merged.source).toBe(schedulesTimestamp.source);
        expect(merged.eventType).toBe(schedulesTimestamp.eventType);
        expect(merged.recordTime).toBe(schedulesTimestamp.recordTime);
        expect(merged.ship).toMatchObject(schedulesTimestamp.ship);
        expect(merged.location).toMatchObject(schedulesTimestamp.location);
    });

});