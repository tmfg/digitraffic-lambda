import * as TimestampsDB from "../dao/timestamps";
import {
    DbETAShip,
    DbTimestamp,
    DbTimestampIdAndLocode,
    DbUpdatedTimestamp,
} from "../dao/timestamps";
import {
    DTDatabase,
    DTTransaction,
    inDatabase,
    inDatabaseReadonly,
} from "@digitraffic/common/dist/database/database";
import { ApiTimestamp, Ship } from "../model/timestamp";
import {
    getDisplayableNameForEventSource,
    isPortnetTimestamp,
    mergeTimestamps,
} from "../event-sourceutil";
import { Port } from "./portareas";
import moment from "moment-timezone";
import * as R from "ramda";
import { EventSource } from "../model/eventsource";

export interface UpdatedTimestamp extends DbUpdatedTimestamp {
    readonly locodeChanged: boolean;
}

export function saveTimestamp(
    timestamp: ApiTimestamp,
    db: DTDatabase
): Promise<UpdatedTimestamp | null> {
    return db.tx(async (t) => {
        const portcallId =
            timestamp.portcallId ??
            (await TimestampsDB.findPortcallId(
                db,
                timestamp.location.port,
                timestamp.eventType,
                moment(timestamp.eventTime).toDate(),
                timestamp.ship.mmsi,
                timestamp.ship.imo
            ));

        if (!portcallId) {
            if (timestamp.source !== EventSource.AWAKE_AI_PRED) {
                console.warn(
                    "method=saveTimestamp no port call id could be found for, not persisting timestamp: %s",
                    JSON.stringify(timestamp)
                );
                // resolve so this gets removed from the queue
                return null;
            } else {
                console.info(
                    "method=saveTimestamp portcall id not found but persisting because source is: ${EventSource.AWAKE_AI_PRED}, timestamp: %s",
                    JSON.stringify(timestamp)
                );
            }
        }

        // mmsi should exist in this case
        const imo =
            timestamp.ship.imo ??
            (await TimestampsDB.findImoByMmsi(db, timestamp.ship.mmsi));
        if (!imo) {
            console.warn(
                "method=saveTimestamp IMO not found for timestamp %s",
                JSON.stringify(timestamp)
            );
            // resolve so this gets removed from the queue
            return null;
        }

        // imo should exist in this case
        const mmsi =
            timestamp.ship.mmsi ??
            (await TimestampsDB.findMmsiByImo(db, timestamp.ship.imo));
        if (!mmsi) {
            console.warn(
                "method=saveTimestamp MMSI not found for timestamp %s",
                JSON.stringify(timestamp)
            );
            // resolve so this gets removed from the queue
            return null;
        }

        const ship: Ship = {
            imo,
            mmsi,
        };

        return doSaveTimestamp(t, { ...timestamp, ...{ portcallId, ship } });
    });
}

export function saveTimestamps(
    timestamps: ApiTimestamp[]
): Promise<(DbUpdatedTimestamp | null)[]> {
    return inDatabase((db: DTDatabase) => {
        return db.tx((t) =>
            t.batch(
                timestamps.map((timestamp) => doSaveTimestamp(t, timestamp))
            )
        );
    });
}

async function doSaveTimestamp(
    tx: DTTransaction,
    timestamp: ApiTimestamp
): Promise<UpdatedTimestamp | null> {
    const removedTimestamps = await removeOldTimestamps(tx, timestamp);
    const updatedTimestamp = await TimestampsDB.updateTimestamp(tx, timestamp);
    return updatedTimestamp
        ? { ...updatedTimestamp, locodeChanged: removedTimestamps.length > 0 }
        : null;
}

async function removeOldTimestamps(
    tx: DTTransaction,
    timestamp: ApiTimestamp
): Promise<DbTimestampIdAndLocode[]> {
    let timestampsAnotherLocode: DbTimestampIdAndLocode[] = [];
    if (isPortnetTimestamp(timestamp) && timestamp.portcallId) {
        timestampsAnotherLocode =
            await TimestampsDB.findPortnetTimestampsForAnotherLocode(
                tx,
                timestamp.portcallId,
                timestamp.location.port
            );
        if (timestampsAnotherLocode.length) {
            console.info(
                "method=doSaveTimestamp deleting timestamps with changed locode,timestamp ids: %s",
                timestampsAnotherLocode.map((e) => e.id).toString()
            );
            await tx.batch(
                timestampsAnotherLocode.map((e) =>
                    TimestampsDB.deleteById(tx, e.id)
                )
            );
        }
    }
    return timestampsAnotherLocode;
}

export async function findAllTimestamps(
    locode?: string,
    mmsi?: number,
    imo?: number,
    source?: string
): Promise<ApiTimestamp[]> {
    const start = Date.now();

    const timestamps: ApiTimestamp[] = await inDatabaseReadonly(
        async (db: DTDatabase) => {
            if (locode) {
                return TimestampsDB.findByLocode(db, locode);
            } else if (mmsi && !imo) {
                return TimestampsDB.findByMmsi(db, mmsi);
            } else if (imo) {
                return TimestampsDB.findByImo(db, imo);
            } else if (source) {
                return TimestampsDB.findBySource(db, source);
            }
            console.warn(
                "method=findAllTimestamps no locode, mmsi, imo or source given"
            );
            return [];
        }
    )
        .finally(() => {
            console.info(
                "method=findAllTimestamps tookMs=%d",
                Date.now() - start
            );
        })
        .then((tss: DbTimestamp[]) =>
            tss.map((e) => ({
                eventType: e.event_type,
                eventTime: e.event_time.toISOString(),
                recordTime: e.record_time.toISOString(),
                eventTimeConfidenceLower: e.event_time_confidence_lower,
                eventTimeConfidenceUpper: e.event_time_confidence_upper,
                source: getDisplayableNameForEventSource(e.event_source),
                sourceId: e.source_id,
                ship: {
                    mmsi: e.ship_mmsi,
                    imo: e.ship_imo,
                },
                location: {
                    port: e.location_locode,
                    portArea: e.location_portarea,
                    from: e.location_from_locode,
                },
                portcallId: e.portcall_id,
            }))
        );
    return mergeTimestamps(timestamps) as ApiTimestamp[];
}

export async function findETAShipsByLocode(
    ports: Port[]
): Promise<DbETAShip[]> {
    console.info("method=findETAShipsByLocode find for %s", ports.toString());

    const startFindPortnetETAsByLocodes = Date.now();
    const portnetShips = await inDatabaseReadonly((db: DTDatabase) => {
        return TimestampsDB.findPortnetETAsByLocodes(db, ports);
    }).finally(() => {
        console.info(
            "method=findPortnetETAsByLocodes tookMs=%d",
            Date.now() - startFindPortnetETAsByLocodes
        );
    });

    // handle multiple ETAs for the same day: calculate ETA only for the port call closest to NOW
    const shipsByImo = R.groupBy((s) => s.imo.toString(), portnetShips);
    const newestShips = Object.values(shipsByImo)
        .flatMap((ships) =>
            R.head(
                R.sortBy((ship: DbETAShip) => moment(ship.eta).toDate(), ships)
            )
        )
        .filter((ship): ship is DbETAShip => ship !== undefined);

    console.info(
        "method=findPortnetETAsByLocodes ships count before newest ETA filtering %d, after newest ETA filtering %d",
        portnetShips.length,
        newestShips.length
    );

    if (newestShips.length) {
        const startFindVtsShipsTooCloseToPort = Date.now();
        return await inDatabaseReadonly(async (db: DTDatabase) => {
            const shipsTooCloseToPortImos = (
                await TimestampsDB.findVtsShipImosTooCloseToPortByPortCallId(
                    db,
                    newestShips.map((ship) => ship.portcall_id)
                )
            ).map((ship) => ship.imo);
            console.info(
                "method=findETAShipsByLocode Ships too close to port",
                shipsTooCloseToPortImos
            );
            const filteredShips = newestShips.filter((ship) =>
                shipsTooCloseToPortImos.includes(ship.imo)
            );
            console.info(
                "method=findETAShipsByLocode Did not fetch ETA for ships too close to port",
                filteredShips
            );
            return newestShips.filter(
                (ship) => !shipsTooCloseToPortImos.includes(ship.imo)
            );
        }).finally(() => {
            console.info(
                "method=startFindVtsShipsTooCloseToPort tookMs=%d",
                Date.now() - startFindVtsShipsTooCloseToPort
            );
        });
    } else {
        return Promise.resolve([]);
    }
}

export function deleteOldTimestampsAndPilotages() {
    return inDatabase((db: DTDatabase) => {
        return db.tx(async (t) => {
            const deletedPilotagesCount = await TimestampsDB.deleteOldPilotages(
                t
            );
            console.info(
                "method=TimestampsService.deleteOldTimestamps pilotages count=%d",
                deletedPilotagesCount
            );

            const deletedTimestampsCount =
                await TimestampsDB.deleteOldTimestamps(t);
            console.info(
                "method=TimestampsService.deleteOldTimestamps timestamps count=%d",
                deletedTimestampsCount
            );
        });
    });
}
