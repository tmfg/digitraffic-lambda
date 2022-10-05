import {ApiTimestamp} from "../lib/model/timestamp";
import {DbTimestamp} from "../lib/dao/timestamps";
import * as TimestampsDb from '../lib/dao/timestamps';
import {PortAreaDetails, PortCall, Vessel} from "./testdata";
import {dbTestBase as commonDbTestBase} from "@digitraffic/common/test/db-testutils";
import {DTDatabase, DTTransaction} from "@digitraffic/common/database/database";
import {updatePilotages} from "../lib/dao/pilotages";

export function dbTestBase(fn: (db: DTDatabase) => void): () => void {
    return commonDbTestBase(
        fn, truncate, 'portactivity', 'portactivity', 'localhost:54321/marine',
    );
}

export function inTransaction(db: DTDatabase | DTTransaction, fn: (t: DTTransaction) => void) {
    return async (): Promise<void> => {
        await db.tx(async (t: DTTransaction) => { await fn(t); });
    };
}

export async function truncate(db: DTDatabase | DTTransaction): Promise<void> {
    await db.tx(async t => {
        await t.none('DELETE FROM pilotage');
        await t.none('DELETE FROM port_call_timestamp');
        await t.none('DELETE FROM public.vessel');
        await t.none('DELETE FROM public.port_area_details');
        await t.none('DELETE FROM public.port_call');
    });
}

export function findAll(db: DTDatabase | DTTransaction): Promise<DbTimestamp[]> {
    return db.tx(t => {
        return t.manyOrNone(`
        SELECT
            event_type,
            event_time,
            event_time_confidence_lower,
            event_time_confidence_lower_diff,
            event_time_confidence_upper,
            event_time_confidence_upper_diff,
            event_source,
            record_time,
            ship_mmsi,
            ship_imo,
            location_locode,
            location_portarea,
            location_from_locode,
            portcall_id
        FROM port_call_timestamp`);
    });
}

export async function getPilotagesCount(db: DTDatabase | DTTransaction): Promise<number> {
    const ret = await db.tx(t => t.one('SELECT COUNT(*) FROM pilotage'));
    return ret.count;
}

export async function insert(db: DTDatabase | DTTransaction, timestamps: ApiTimestamp[]): Promise<void> {
    await db.tx(t => {
        return t.batch(timestamps.map(e => {
            return t.none(`
                INSERT INTO port_call_timestamp(
                    event_type,
                    event_time,
                    event_time_confidence_lower,
                    event_time_confidence_lower_diff,
                    event_time_confidence_upper,
                    event_time_confidence_upper_diff,
                    event_source,
                    record_time,
                    location_locode,
                    ship_mmsi,
                    ship_imo,
                    portcall_id,
                    location_portarea,
                    location_from_locode,
                    source_id)
                VALUES(
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15
                )
            `, TimestampsDb.createUpdateValues(e));
        }));
    });
}

export async function insertVessel(db: DTDatabase | DTTransaction, vessel: Vessel): Promise<void> {
    await db.tx(t => {
        t.none(`
            INSERT INTO public.vessel(
                mmsi,
                timestamp,
                name,
                ship_type,
                reference_point_a,
                reference_point_b,
                reference_point_c,
                reference_point_d,
                pos_type,
                draught,
                imo,
                eta,
                call_sign,
                destination
            ) VALUES (
                $(mmsi),
                $(timestamp),
                $(name),
                $(ship_type),
                $(reference_point_a),
                $(reference_point_b),
                $(reference_point_c),
                $(reference_point_d),
                $(pos_type),
                $(draught),
                $(imo),
                $(eta),
                $(call_sign),
                $(destination)
            )
        `, vessel);
    });
}

export async function insertPortAreaDetails(db: DTTransaction | DTDatabase, p: PortAreaDetails): Promise<void> {
    await db.none(`
        INSERT INTO public.port_area_details(
            port_area_details_id,
            port_call_id,
            eta,
            etd,
            ata,
            atd
        ) VALUES (
            $(port_area_details_id),
            $(port_call_id),
            $(eta),
            $(etd),
            $(ata),
            $(atd)
        )
    `, p);
}

export async function insertPortCall(db: DTTransaction | DTDatabase, p: PortCall): Promise<void> {
    await db.none(`
        INSERT INTO public.port_call(
            port_call_id,
            radio_call_sign,
            radio_call_sign_type,
            vessel_name,
            port_call_timestamp,
            port_to_visit,
            mmsi,
            imo_lloyds
        ) VALUES (
            $(port_call_id),
            $(radio_call_sign),
            $(radio_call_sign_type),
            $(vessel_name),
            $(port_call_timestamp),
            $(port_to_visit),
            $(mmsi),
            $(imo_lloyds)
        )
    `, p);
}

export function insertPilotage(
    db: DTDatabase,
    id: number,
    state: string,
    scheduleUpdated: Date,
    endTime?: Date,
): Promise<unknown> {
    return updatePilotages(db, [{
        id,
        vessel: {
            name: 'test',
            imo: 1,
            mmsi: 1,
        },
        vesselEta: new Date().toISOString(),
        pilotBoardingTime: new Date().toISOString(),
        endTime: endTime?.toISOString() ?? new Date().toISOString(),
        scheduleUpdated: scheduleUpdated.toISOString(),
        scheduleSource: 'test',
        state,
        route: {
            start: {
                code: 'START',
            },
            end: {
                code: 'END',
            },
        },
    }]);
}
