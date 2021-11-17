import {inDatabase, inDatabaseReadonly} from "digitraffic-common/postgres/database";
import * as MetadataDB from "../db/metadata";

import {IDatabase} from "pg-promise";
import {Camera} from "../model/camera";

export async function listAllCameras(usersGroups: string[]): Promise<Camera[]> {
    console.info("method=listAllCameras for " + usersGroups);

    const start = Date.now();

    try {
        return await inDatabaseReadonly(async (db: IDatabase<unknown>) => {
            return MetadataDB.getAllCameras(db, usersGroups);
        });
    } finally {
        console.info("method=listAllCameras tookMs=%d", (Date.now() - start));
    }
}

export async function updateMetadataUpdated(cameraIds: string[], updated: Date): Promise<any> {
    return inDatabase(async (db: IDatabase<unknown>) => {
        return MetadataDB.updateCameraMetadata(db, cameraIds, updated);
    });
}

export async function getAllCameraIdsForGroup(groupId: string): Promise<string[]> {
    return inDatabaseReadonly(async (db: IDatabase<unknown>) => {
        return MetadataDB.getAllCameraIdsForGroup(db, groupId);
    });
}
