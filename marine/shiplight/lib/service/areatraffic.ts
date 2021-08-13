import {IDatabase} from "pg-promise";
import {inDatabase} from "digitraffic-common/postgres/database";
import * as AreaTrafficDb from '../db/areatraffic';
import {AreaTraffic} from "../model/areatraffic";
import {DbAreaTraffic} from "../db/areatraffic";

const BRIGHTEN_OVERLAP_INTERVAL_MILLIS = 60 * 1000; // one minute

export function getAreaTraffic(): Promise<AreaTraffic[]> {
    return inDatabase(async (db: IDatabase<any, any>) => {
        const areas = await AreaTrafficDb.getAreaTraffic(db);

        return areas
            .filter(needToBrighten)
            .map(area => ({
                areaId: area.id,
                durationInMinutes: area.brighten_duration_min
            }));
    });
}

export function needToBrighten(area: DbAreaTraffic): boolean {
    // if lights have never been brightened or brighting has already ended(calculated with a bit of overlap)
    return area.brighten_end == null || isEndTimeBeforeNow(area.brighten_end.getTime());
}

function isEndTimeBeforeNow(endTime: number): boolean {
    return endTime < (Date.now() + BRIGHTEN_OVERLAP_INTERVAL_MILLIS);
}