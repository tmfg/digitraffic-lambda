import {IDatabase, PreparedStatement} from "pg-promise";


export interface DbMaintenanceTrackingData {
    readonly json: string,
    readonly status: Status
}

export enum Status {
    UNHANDLED = 'UNHANDLED',
    HANDLED = 'HANDLED',
    ERROR = 'ERROR'
}

/*
CREATE SEQUENCE SEQ_MAINTENANCE_TRACKING_DATA;

CREATE TABLE IF NOT EXISTS MAINTENANCE_TRACKING_DATA
(
    id              BIGINT NOT NULL PRIMARY KEY,
    json            TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL,
    handling_info   TEXT,
    created         TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    modified        TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW()
);
 */

const INSERT_ESTIMATE_SQL = `
    INSERT INTO maintenance_tracking_data(id, json, status)
    VALUES(NEXTVAL('SEQ_MAINTENANCE_TRACKING_DATA'), $1, $2)
`;
// ON CONFLICT(ship_id, event_source, event_time, record_time) DO NOTHING

export function insertMaintenanceTrackingData(db: IDatabase<any, any>, tracking: DbMaintenanceTrackingData): Promise<any> {
    const ps = new PreparedStatement({
        name: 'insert-tracking',
        text: INSERT_ESTIMATE_SQL,
    });
    return db.oneOrNone(ps, createUpdateValues(tracking));
}

export function createUpdateValues(e: DbMaintenanceTrackingData): any[] {
    return [
        e.json,
        e.status
    ];
}