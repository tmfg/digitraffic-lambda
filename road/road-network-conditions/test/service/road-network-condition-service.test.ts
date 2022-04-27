import axios from "axios";

import * as rcs from "../../lib/service/road-network-conditions-service";
import {FeatureCollection} from "geojson";

jest.mock('axios');

const ALARM_TYPES = [
    {alarmId: 1, alarmText: "Tienpinta pakkaselle"},
    {alarmId: 2, alarmText: "Lumi alkaa kertyä tienpinnalle"},
    {alarmId: 3, alarmText: "Kitkahälytys"},
];

const ALARMS = [
    {
        created: "2022-01-17 10:36:00",
        station: "1000108",
        alarm: "1",
    },
    {
        created: "2022-01-17 10:15:58",
        station: "1000108",
        alarm: "3",
    },
];

const DEVICE = {
    deviceId: "1000108",
    deviceName: "IRS - Vesijärvenkatu 9",
    deviceType: "IRS",
    coordinates: {latitude: 60.982431, longitude: 25.661484},
};

const DEVICES = [
    {
        deviceId: "4025",
        deviceName: "LTI - Tie 12 Lahti, Kärpäsenmäki - ID4025",
        deviceType: "Digitraffic",
        coordinates: {latitude: 60.980391, longitude: 25.601004},
    },
    {
        deviceId: "18005",
        deviceName: "LTI - Kivistönmäki - ID18005",
        deviceType: "Digitraffic",
        coordinates: {latitude: 61.000532, longitude: 25.675391},
    },
    DEVICE,
];

describe("Road network condition service", () => {

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("should fetch devices from the api", () => {
        const data = { devices: DEVICES };

        const expected: FeatureCollection = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [DEVICE.coordinates.latitude, DEVICE.coordinates.longitude],
                    },
                    properties: {
                        deviceId: DEVICE.deviceId,
                        deviceName: DEVICE.deviceName,
                        deviceType: DEVICE.deviceType,
                    },
                },
            ],
        };

        (axios.get as unknown as jest.Mock).mockResolvedValueOnce({ status: 200, data});

        return rcs.getDevicesFeatureCollection("", "")
            .then(d => expect(d).toEqual(expected))
            .then(() => expect(axios.get).toHaveBeenCalledWith(`/keli/laitetiedot?authKey=`));
    });

    it("should combine alarm, alarm types and device information", () => {
        const devices = {
            devices: [DEVICE],
        };

        const alarmTypes = { alarmTypes: ALARM_TYPES };
        const alarms = ALARMS;

        (axios.get as unknown as jest.Mock).mockImplementation((req) => {
            const data =
                req.includes("laitetiedot") ?
                    devices :
                    req.includes("halytykset") ?
                        alarms :
                        alarmTypes;

            return Promise.resolve({
                status: 200,
                data,
            });
        });

        const dateMatcher = expect.stringMatching(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
        const alarmIdMatcher = expect.stringMatching(/\d{1,2}/);
        const alarmTextMatcher = expect.stringMatching(/\s+/);

        const desiredFeatureCollection = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {
                        created: dateMatcher,
                        alarmId: alarmIdMatcher,
                        alarmText: alarmTextMatcher,
                        deviceId: DEVICE.deviceId,
                    },
                },
                {
                    type: "Feature",
                    properties: {
                        created: dateMatcher,
                        alarmId: alarmIdMatcher,
                        alarmText: alarmTextMatcher,
                        deviceId: DEVICE.deviceId,
                    },
                },
            ],
        };

        expect(rcs.getAlarmsGeojson("", "")).resolves.toMatchObject(desiredFeatureCollection);
    });

    it("should work with alarms with unknown devices", () => {
        // add unknown device to the device listing
        const devices = {
            devices: [
                {
                    deviceId: "1337",
                    deviceName: "IRS - Vesijärvenkatu 9",
                    deviceType: "IRS",
                    coordinates: {latitude: 60.982431, longitude: 25.661484},
                },
            ],
        };
        const alarmTypes = {
            alarmTypes: ALARM_TYPES,
        };
        const alarms = ALARMS;

        (axios.get as unknown as jest.Mock).mockImplementation((req) => {
            const data =
                req.includes("laitetiedot") ?
                    devices :
                    req.includes("halytykset") ?
                        alarms :
                        alarmTypes;

            return Promise.resolve({
                status: 200,
                data,
            });
        });

        const expected: FeatureCollection = {
            type: "FeatureCollection",
            features: [],
        };

        expect(rcs.getAlarmsGeojson("", "")).resolves.toEqual(expected);
    });

    it ("should return error if api sends malformed data", () => {
        // incorrectly formatted device
        const data = {
            devices: [
                {
                    fooId: "1000108",
                    fooName: "IRS - Vesijärvenkatu 9",
                    fooType: "IRS",
                    coordinates: {latitude: 60.982431, longitude: 25.661484},
                },
            ],
        };

        const expected = new Error("unable to parse road condition device");

        (axios.get as unknown as jest.Mock).mockResolvedValueOnce({ status: 200, data});

        return expect(rcs.getDevicesFeatureCollection("", "")).rejects.toEqual(expected);
    });

    it("should fetch alarms", () => {
        const data = ALARMS;

        const expected = data;

        (axios.get as unknown as jest.Mock).mockResolvedValueOnce({ status: 200, data});

        return rcs.getAlarms("", "")
            .then(d => expect(d).toEqual(expected))
            .then(() => expect(axios.get).toHaveBeenCalledWith(`/keli/halytykset?authKey=`));
    });

    it("should fail with malformed alarms", () => {
        // incorrect alarm
        const data = [
            {
                created: "2022-01-17 03:19:28",
                station: "1000120",
                alarm: "not-a-number",
            },
        ];

        const expected = new Error("unable to parse alarm type");

        (axios.get as unknown as jest.Mock).mockResolvedValueOnce({ status: 200, data});

        return expect(rcs.getAlarms("", "")).rejects.toEqual(expected);
    });

    it("should fetch alarm type description", () => {
        const data = {
            alarmTypes: ALARM_TYPES,
        };

        const expected = data.alarmTypes.map(x => ({...x, alarmId: String(x.alarmId)}));

        (axios.get as unknown as jest.Mock).mockResolvedValueOnce({ status: 200, data});

        return rcs.getAlarmTypes("", "")
            .then(d => expect(d).toEqual(expected))
            .then(() => expect(axios.get).toHaveBeenCalledWith(`/keli/halytystyypit?authKey=`));
    });

    it("should fail with malformed alarm types", () => {
        const data = {
            alarmTypes: [
                {
                    unknown: "2022-01-17 03:19:28",
                    alarm: "not-a-number",
                },
            ],
        };

        const expected = new Error("unable to parse alarm type");

        (axios.get as unknown as jest.Mock).mockResolvedValueOnce({ status: 200, data});

        return expect(rcs.getAlarmTypes("", "")).rejects.toEqual(expected);
    });
});
