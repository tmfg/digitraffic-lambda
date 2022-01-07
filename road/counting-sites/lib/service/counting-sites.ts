import * as CounterDb from "../db/counter";
import * as DataDb from "../db/data";
import * as LastUpdatedDB from "digitraffic-common/db/last-updated";
import * as MetadataDB from "../db/metadata";
import {DTDatabase, inDatabaseReadonly} from "digitraffic-common/postgres/database";
import {DbDomain} from "../model/domain";
import {DbData} from "../model/data";
import {FeatureCollection} from "geojson";
import {DbUserType} from "../model/usertype";
import {MetadataResponse} from "../model/metadata";

export function getMetadata(): Promise<MetadataResponse> {
    return inDatabaseReadonly(async (db: DTDatabase) => {
        const domains = await MetadataDB.findAllDomains(db);
        const userTypes = await MetadataDB.findAllUserTypes(db);
        const lastUpdated = await LastUpdatedDB.getLastUpdated(db, LastUpdatedDB.DataType.COUNTING_SITES_DATA);

        return createResponse(domains, userTypes, lastUpdated);
    });
}

export function getDataForCounter(counterId: number): Promise<DbData[]> {
    // should we return error, when counter is not found?
    return inDatabaseReadonly((db: DTDatabase) => {
        return DataDb.findAllData(db, counterId);
    });
}

export function getCountersForDomain(domain: string): Promise<FeatureCollection> {
    // should we return error, when domain is not found?
    return inDatabaseReadonly((db: DTDatabase) => {
        return CounterDb.findAllCountersForDomain(db, domain);
    });
}

function createResponse(domains: DbDomain[], userTypes: DbUserType[], lastUpdated: Date|null): MetadataResponse {
    return {
        lastUpdated,
        domains,
        userTypes,
        directions: {
            "1": "in",
            "2": "out",
            "5": "no direction",
        },
    };
}