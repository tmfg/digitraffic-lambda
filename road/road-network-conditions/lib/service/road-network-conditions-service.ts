import {Feature, FeatureCollection} from "geojson";
import * as R from "ramda";

import {RoadConditionApi} from "../api/road-condition";
import {Coordinates, Device, Devices} from "../model/road-condition-devices";
import {Alarm, Alarms} from "../model/road-condition-alarms";
import {AlarmType, AlarmTypes} from "../model/road-condition-alarm-types";


function makeFeatureCollection(xs: Array<Feature>): FeatureCollection {
    return {
        type: "FeatureCollection",
        features: xs,
    };
}

function makeGeoJson(props: Record<string, string>, coordinates: Coordinates): Feature {
    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [coordinates.latitude, coordinates.longitude],
        },
        properties: props,
    };
}

function makeDeviceToGeoJSON(device: Device): Feature {
    const props = R.pick(["deviceId", "deviceName", "deviceType"], device);
    return makeGeoJson(props, device.coordinates);
}

export function getDevices(apiKey: string, url: string): Promise<Devices> {
    const api = new RoadConditionApi(apiKey, url);
    return api.getDevices()
        .then(xs => xs.filter(x => x.deviceType !== "Digitraffic"))
        .catch(e => {
            console.error("method=road-network-conditions-service.getDevices couldn't reach api", e);
            return Promise.reject(e);
        });
}

export function getDevicesFeatureCollection(apiKey: string, url: string): Promise<FeatureCollection> {
    return getDevices(apiKey, url)
        .then(xs => xs.map(makeDeviceToGeoJSON))
        .then(makeFeatureCollection);
}

export function getAlarms(apiKey: string, url: string): Promise<Alarms> {
    const api = new RoadConditionApi(apiKey, url);
    return api.getAlarms()
        .catch(e => {
            console.error("method=road-network-conditions-service.getAlarms couldn't reach api", e);
            return Promise.reject(e);
        });
}

export function getAlarmTypes(apiKey: string, url: string): Promise<AlarmTypes> {
    const api = new RoadConditionApi(apiKey, url);
    return api.getAlarmTypes()
        .catch(e => {
            console.error("method=road-network-conditions-service.getAlarmTypes couldn't reach api", e);
            return Promise.reject(e);
        });
}

const combineAlarmsAndTypes = (alarmTypes: AlarmTypes) => (alarm: Alarm): Alarm & AlarmType => {
    return {
        ...alarm,
        ...alarmTypes.filter(x => x.alarmId === alarm.alarm)[0],
    };
};

const withDevices = (devices: Devices) => (alarm: Alarm & AlarmType): Feature => {
    const device = devices.filter(d => d.deviceId === alarm.station)[0];

    const deviceProps = R.pick(["deviceId", "deviceName", "deviceType"], device);
    const alarmProps = R.pick(["alarmId", "alarmText", "created"], alarm);
    const props = {...deviceProps, ...alarmProps};

    return makeGeoJson(props, device.coordinates);
};

export async function getFeatureCollection(apiKey: string, url: string): Promise<FeatureCollection> {
    const [devices, alarms, alarmTypes] =
        await Promise.all([
            getDevices(apiKey, url),
            getAlarms(apiKey, url),
            getAlarmTypes(apiKey, url),
        ]);

    const alarmsAndTypes: ReadonlyArray<Alarm & AlarmType> = alarms.map(combineAlarmsAndTypes(alarmTypes));

    return {
        type: "FeatureCollection",
        features: alarmsAndTypes.map(withDevices(devices)),
    };
}
