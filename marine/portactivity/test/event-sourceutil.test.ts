import {
    momentAverage,
    mergeTimestamps, VTS_TIMESTAMP_DIFF_MINUTES, VTS_TIMESTAMP_TOO_OLD_MINUTES,
} from "../lib/event-sourceutil";
import moment from "moment-timezone";
import {newTimestamp} from "./testdata";
import {ApiTimestamp} from "../lib/model/timestamp";
import {EventSource} from "../lib/model/eventsource";
import {getRandomInteger, shuffle} from "digitraffic-common/test/testutils";

describe('event-sourceutil', () => {
    test('momentAverage', () => {
        const m1 = moment(1622549546737);
        const m2 = moment(1622549553609);

        const average = momentAverage([m1, m2]);

        expect(average).toBe('2021-06-01T12:12:30.173Z');
    });

    test('mergeTimestamps - filters out all but one', () => {
        const portcallId = 1;
        const timestamps = [
            newTimestamp({ source: EventSource.SCHEDULES_CALCULATED, portcallId }),
            newTimestamp({ source: EventSource.AWAKE_AI, portcallId }),
        ];

        const merged = mergeTimestamps(timestamps);

        expect(merged.length).toBe(1);
    });

    test('mergeTimestamps - doesnt filter other than VTS A', () => {
        const portcallId = 1;
        const timestamps = [
            newTimestamp({ source: EventSource.SCHEDULES_CALCULATED, portcallId }),
            newTimestamp({ source: EventSource.PORTNET, portcallId }),
            newTimestamp({ source: EventSource.AWAKE_AI, portcallId }),
        ];

        const merged = mergeTimestamps(timestamps);

        expect(merged.length).toBe(2);
    });

    test('mergeTimestamps - timestamps are sorted after merge', () => {
        const portcallId = 1;
        const portnetTime = moment();
        const vtsTimestamp = newTimestamp({ eventTime: portnetTime.add(50, 'minute').toDate(), source: EventSource.SCHEDULES_CALCULATED, portcallId });
        const awakeTimestamp = newTimestamp({ eventTime: portnetTime.add(45, 'minute').toDate(), source: EventSource.AWAKE_AI, portcallId });
        const portnetTimestamp = newTimestamp({ eventTime: portnetTime.toDate(), source: EventSource.PORTNET, portcallId });
        const vtsControlTimestamp = newTimestamp({ eventTime: portnetTime.add(55, 'minute').toDate(), source: EventSource.SCHEDULES_VTS_CONTROL, portcallId });

        const timestamps = shuffle([
            vtsControlTimestamp,
            vtsTimestamp,
            portnetTimestamp,
            awakeTimestamp,
        ]);

        const merged = mergeTimestamps(timestamps);

        expect(merged.length).toBe(3);
        expect(merged[0].source).toBe(EventSource.SCHEDULES_CALCULATED);
        expect(merged[1].source).toBe(EventSource.PORTNET);
        expect(merged[2].source).toBe(EventSource.SCHEDULES_VTS_CONTROL);
    });

    test('mergeTimestamps - picks highest priority source', () => {
        const portcallId = 1;
        const schedulesTimestamp = newTimestamp({ source: EventSource.SCHEDULES_CALCULATED, portcallId });
        const teqplayTimestamp = newTimestamp({ source: EventSource.AWAKE_AI, portcallId });
        const vtsTimestamp = newTimestamp({ source: EventSource.AWAKE_AI, portcallId });
        const timestamps = [
            teqplayTimestamp,
            schedulesTimestamp,
            vtsTimestamp,
        ];

        const merged = mergeTimestamps(timestamps)[0] as ApiTimestamp;

        expectTimestamp(merged, schedulesTimestamp);
    });

    test('mergeTimestamps - too old VTS timestamps are filtered', () => {
        const portcallId = 1;
        const vtsTimestamp = newTimestamp({
            source: EventSource.SCHEDULES_CALCULATED,
            recordTime: moment().subtract(VTS_TIMESTAMP_TOO_OLD_MINUTES + getRandomInteger(0, 1000), 'minute').toDate(),
            portcallId,
        });
        const timestamps = [
            vtsTimestamp,
        ];

        expect(mergeTimestamps(timestamps).length).toBe(0);
    });

    test('mergeTimestamps - VTS timestamp differing too much from Awake timestamp is filtered', () => {
        const portcallId = 1;
        const awakeTimestamp = newTimestamp({ source: EventSource.AWAKE_AI, portcallId });
        const vtsTimestamp = newTimestamp({
            source: EventSource.SCHEDULES_CALCULATED,
            eventTime: moment(awakeTimestamp.eventTime).add(VTS_TIMESTAMP_DIFF_MINUTES + getRandomInteger(0, 1000), 'minute').toDate(),
            portcallId,
        });
        const timestamps = [
            awakeTimestamp,
            vtsTimestamp,
        ];

        expectSingleTimestamp(mergeTimestamps(timestamps) as ApiTimestamp[], awakeTimestamp);
    });

    test('PRED timestamps are filtered out if VTS a timestamps are available', () => {
        const portcallId = 1;
        const awakeTimestamp = newTimestamp({ source: EventSource.AWAKE_AI, portcallId });
        const predTimestamp = newTimestamp({ source: EventSource.AWAKE_AI_PRED, portcallId });
        const timestamps = [
            awakeTimestamp,
            predTimestamp,
        ];

        expectSingleTimestamp(mergeTimestamps(timestamps) as ApiTimestamp[], awakeTimestamp);
    });

    function expectSingleTimestamp(mergedTimestamps: ApiTimestamp[], timestamp: ApiTimestamp) {
        expect(mergedTimestamps.length).toBe(1);
        const merged = mergedTimestamps[0];
        expectTimestamp(timestamp, merged);
    }

    function expectTimestamp(actual: ApiTimestamp, expected: ApiTimestamp) {
        expect(actual.portcallId).toBe(expected.portcallId);
        expect(actual.source).toBe(expected.source);
        expect(actual.eventType).toBe(expected.eventType);
        expect(actual.recordTime).toBe(expected.recordTime);
        expect(actual.ship).toMatchObject(expected.ship);
        expect(actual.location).toMatchObject(expected.location);
    }

    test('PRED timestamps with multiple ships', () => {
        const awakeTimestamp1 = newTimestamp({ source: EventSource.AWAKE_AI, portcallId: 1 });
        const predTimestamp1 = newTimestamp({ source: EventSource.AWAKE_AI_PRED, portcallId: 1 });
        const predTimestamp2 = newTimestamp({ source: EventSource.AWAKE_AI_PRED, portcallId: 2 });

        const timestamps = [
            awakeTimestamp1,
            predTimestamp1,
            predTimestamp2,
        ];

        const merged = mergeTimestamps(timestamps) as ApiTimestamp[];
        expect(merged.length).toBe(2);
        expectTimestamp(merged[0], awakeTimestamp1);
        expectTimestamp(merged[1], predTimestamp2);
    });

});
