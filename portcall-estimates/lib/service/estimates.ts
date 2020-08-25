import * as LastUpdatedDB from "../../../common/db/last-updated";
import * as EstimatesDB from "../db/db-estimates"
import {DbEstimate, ShipIdType} from "../db/db-estimates"
import {inDatabase} from "../../../common/postgres/database";
import {IDatabase} from "pg-promise";
import {ApiEstimate} from "../model/estimate";

const PORTCALL_ESTIMATES_DATA_TYPE = 'PORTCALL_ESTIMATES';

export async function saveEstimates(estimates: ApiEstimate[]) {
    const start = Date.now();
    await inDatabase(async (db: IDatabase<any, any>) => {
        return await db.tx(t => {
            const queries = EstimatesDB.updateEstimates(db, estimates).concat([
                LastUpdatedDB.updateUpdatedTimestamp(db, PORTCALL_ESTIMATES_DATA_TYPE, new Date(start))
            ]);
            return t.batch(queries);
        });
    }).then(a => {
        const end = Date.now();
        // minus one for lastupdated
        console.info("method=saveEstimates updatedCount=%d tookMs=%d", a.length-1, (end - start));
    });
}

export async function findAllEstimates(
    locode?: string,
    mmsi?: number,
    imo?: number
): Promise<ApiEstimate[]> {
    const start = Date.now();
    return await inDatabase(async (db: IDatabase<any, any>) => {
        if (locode) {
            return EstimatesDB.findByLocode(db, locode!!);
        } else if (mmsi && !imo) {
            return EstimatesDB.findByMmsi(db, mmsi!!);
        } else if (imo) {
            return EstimatesDB.findByImo(db, imo!!);
        }
        throw new Error('No locode, mmsi or imo given');
    }).finally(() => {
        console.info("method=findAllEstimates tookMs=%d", (Date.now() - start));
    }).then((estimates: DbEstimate[]) => estimates.map(e => ({
        eventType: e.event_type,
        eventTime: e.event_time.toISOString(),
        recordTime:e.record_time.toISOString(),
        eventTimeConfidenceLower: e.event_time_confidence_lower,
        eventTimeConfidenceUpper: e.event_time_confidence_upper,
        source: e.event_source,
        ship: {
            mmsi: e.ship_id_type == ShipIdType.MMSI ? e.ship_id : undefined,
            imo: e.ship_id_type == ShipIdType.IMO ? e.ship_id : e.secondary_ship_id
        },
        location: {
            port: e.location_locode
        }
    })));
}