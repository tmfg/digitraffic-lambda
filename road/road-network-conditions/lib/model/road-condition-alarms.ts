
export type Alarm = {
    readonly created: string;
    readonly station: string;
    readonly alarm: number;
}

export type Alarms = ReadonlyArray<Alarm>

type MaybeAlarm = {
    readonly created?: string;
    readonly station?: string;
    readonly alarm?: string;
}

function alarmParser(x: unknown): Alarm {
    const maybeAlarm = x as MaybeAlarm;

    if (("created" in maybeAlarm && typeof maybeAlarm.created === "string") &&
        ("station" in maybeAlarm && typeof maybeAlarm.station === "string") &&
        ("alarm" in maybeAlarm && typeof maybeAlarm.alarm === "string")) {
        const alarm = parseInt(maybeAlarm.alarm, 10);

        if (isNaN(alarm)) {
            throw new Error("unable to parse alarm type");
        }

        return {
            created: maybeAlarm.created,
            station: maybeAlarm.station,
            alarm,
        };
    }

    throw new Error("unable to parse alarm");
}

export function alarmsParser(x: unknown): Alarms {
    if (typeof x === 'object' && x instanceof Array) {
        return x.map(alarmParser);
    }

    throw new Error("unable to parse alarms");
}
