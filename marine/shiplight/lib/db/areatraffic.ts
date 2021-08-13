import {IDatabase, PreparedStatement} from 'pg-promise';

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

const GET_AREA_TRAFFIC_SQL = `
    SELECT
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

export function getAreaTraffic(db: IDatabase<any, any>): Promise<DbAreaTraffic[]> {
    const ps = new PreparedStatement({
        name: 'get-area-traffic',
        text: GET_AREA_TRAFFIC_SQL
    });
    return db.manyOrNone(ps);
}
