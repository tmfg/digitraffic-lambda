import {IDatabase, PreparedStatement} from "pg-promise";
import {ApiEstimate, EventType} from "../model/estimate";
import moment from "moment";
import {ESTIMATES_BEFORE, ESTIMATES_IN_THE_FUTURE} from "./db-estimates";

export interface DbDebugShiplist {
    readonly event_type: EventType
    readonly event_time: Date
    readonly event_source: string
    readonly ship_name: string
}

const SELECT_BY_LOCODE_DEBUG = `
    WITH newest AS (
        SELECT MAX(record_time) re,
               event_type,
               ship_mmsi,
               ship_imo,
               location_locode,
               event_source
        FROM portcall_estimate
        WHERE
            event_time > ${ESTIMATES_BEFORE} AND
            event_time < ${ESTIMATES_IN_THE_FUTURE} AND
            location_locode = $1
        GROUP BY event_type,
                 ship_mmsi,
                 ship_imo,
                 location_locode,
                 event_source
    )
    SELECT DISTINCT
        pe.event_type,
        pe.event_time,
        pe.event_source,
        vessel.name AS ship_name,
        FIRST_VALUE(pe.event_time) OVER (
            PARTITION BY pe.event_type, pe.ship_mmsi, pe.ship_imo
            ORDER BY
                (CASE WHEN (event_time_confidence_lower IS NULL OR event_time_confidence_upper IS NULL) THEN 1 ELSE -1 END),
                pe.event_time_confidence_lower_diff,
                pe.event_time_confidence_upper_diff,
                pe.record_time DESC
            ) AS event_group_time
    FROM portcall_estimate pe
        JOIN newest ON newest.re = pe.record_time
        AND newest.event_type = pe.event_type
        AND newest.event_source = pe.event_source
        AND newest.location_locode = pe.location_locode
        JOIN vessel ON vessel.mmsi = pe.ship_mmsi AND vessel.imo = pe.ship_imo
    ORDER BY event_group_time
`;

export function findByLocodeDebug(
    db: IDatabase<any, any>,
    locode: string
): Promise<DbDebugShiplist[]> {
    const ps = new PreparedStatement({
        name: 'find-by-locode-debug',
        text: SELECT_BY_LOCODE_DEBUG,
        values: [locode]
    });
    return db.tx(t => t.manyOrNone(ps));
}
