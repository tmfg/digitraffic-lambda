import {PreparedStatement} from 'pg-promise';
import {DTDatabase} from "digitraffic-common/database/database";

export type DbAreaTraffic = {
    readonly id: number
    readonly name: string
    readonly brighten_duration_min: number
    readonly brighten_sent?: Date
    readonly brighten_end?: Date
}

export enum ShipTypes {
    FISHING= 30,
    CARGO = 70,
}

const VALID_SHIP_TYPES = `(${ShipTypes.CARGO})`;
const SHIP_MOVING_INTERVAL = '2 MINUTE';

const SQL_GET_AREA_TRAFFIC = `
    SELECT DISTINCT
        at.id,
        at.name,
        at.brighten_duration_min,
        at.brighten_sent,
        at.brighten_end
    FROM areatraffic at
    JOIN vessel_location vl ON ST_INTERSECTS(at.geometry, ST_MAKEPOINT(vl.x, vl.y))
    JOIN vessel v on vl.mmsi = v.mmsi 
    WHERE TO_TIMESTAMP(vl.timestamp_ext / 1000) >= (NOW() - INTERVAL '${SHIP_MOVING_INTERVAL}')
    AND v.ship_type in ${VALID_SHIP_TYPES} 
`.trim();

const SQL_UPDATE_AREA_TRAFFIC_SENDTIME = `
    UPDATE areatraffic
    SET brighten_sent = NOW(),
        brighten_end = (NOW() + (INTERVAL '1 MINUTE' * brighten_duration_min))
        where id = $1
`.trim();

const PS_GET_AREA_TRAFFIC = new PreparedStatement({
    name: 'get-area-traffic',
    text: SQL_GET_AREA_TRAFFIC,
});

const PS_UPDATE_AREA_TRAFFIC_SENDTIME = new PreparedStatement({
    name: 'update-area-traffic-sendtime',
    text: SQL_UPDATE_AREA_TRAFFIC_SENDTIME,
});

export function getAreaTraffic(db: DTDatabase): Promise<DbAreaTraffic[]> {
    return db.manyOrNone(PS_GET_AREA_TRAFFIC);
}

export function updateAreaTrafficSendTime(db: DTDatabase, areaId: number) {
    return db.none(PS_UPDATE_AREA_TRAFFIC_SENDTIME, [areaId]);
}