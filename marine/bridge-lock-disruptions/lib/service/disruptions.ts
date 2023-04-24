import * as LastUpdatedDB from "@digitraffic/common/dist/database/last-updated";
import * as DisruptionsDB from "../db/disruptions";
import { DTDatabase, inDatabase, inDatabaseReadonly } from "@digitraffic/common/dist/database/database";
import { Feature, FeatureCollection, GeoJSON, Geometry as GeoJSONGeometry } from "geojson";
import { logger } from "@digitraffic/common/dist/aws/runtime/dt-logger-default";
import { Disruption, SpatialDisruption } from "../model/disruption";
import * as DisruptionsApi from "../api/disruptions";
import { createFeatureCollection, isValidGeoJson } from "@digitraffic/common/dist/utils/geometry";
import { DisruptionFeature } from "../api/disruptions";
import { Geometry } from "wkx";
import { parse } from "date-fns";

export const DISRUPTIONS_DATE_FORMAT = "d.M.yyyy H:mm";
const BRIDGE_LOCK_DISRUPTIONS_DATA_TYPE = "BRIDGE_LOCK_DISRUPTIONS";

export function findAllDisruptions(): Promise<FeatureCollection> {
    const start = Date.now();
    return inDatabaseReadonly(async (db: DTDatabase) => {
        const disruptions = await DisruptionsDB.findAll(db);
        const disruptionsFeatures = disruptions.map(convertFeature);
        const lastUpdated = await LastUpdatedDB.getUpdatedTimestamp(db, BRIDGE_LOCK_DISRUPTIONS_DATA_TYPE);
        return createFeatureCollection(disruptionsFeatures, lastUpdated);
    }).finally(() => {
        logger.info({
            method: "DisruptionsService.findAllDisruptions",
            tookMs: Date.now() - start
        });
    });
}

export async function saveDisruptions(disruptions: SpatialDisruption[]) {
    const start = Date.now();
    await inDatabase(async (db: DTDatabase) => {
        await DisruptionsDB.deleteAllButDisruptions(
            db,
            disruptions.map((d) => d.Id)
        );
        return db.tx((t) => {
            return t.batch([
                ...DisruptionsDB.updateDisruptions(db, disruptions),
                LastUpdatedDB.updateUpdatedTimestamp(db, BRIDGE_LOCK_DISRUPTIONS_DATA_TYPE, new Date(start))
            ]);
        });
    }).then((a) => {
        logger.info({
            method: "DisruptionsService.saveDisruptions",
            count: a.length,
            tookMs: Date.now() - start
        });
    });
}

export async function fetchRemoteDisruptions(endpointUrl: string) {
    const disruptions = await DisruptionsApi.getDisruptions(endpointUrl);
    const validDisruptions = disruptions.filter(validateGeoJson);
    return validDisruptions.map(featureToDisruption);
}

export function featureToDisruption(feature: DisruptionFeature): SpatialDisruption {
    const props = feature.properties;

    return {
        Id: props.Id,
        Type_Id: props.Type_Id,
        StartDate: normalizeDisruptionDate(props.StartDate),
        EndDate: normalizeDisruptionDate(props.EndDate),
        DescriptionFi: props.DescriptionFi,
        DescriptionSv: props.DescriptionSv,
        DescriptionEn: props.DescriptionEn,
        geometry: feature.geometry
    };
}

export function normalizeDisruptionDate(dateStr: string): Date {
    return parse(dateStr, DISRUPTIONS_DATE_FORMAT, new Date());
}

export function validateGeoJson(geoJson: GeoJSON) {
    try {
        return isValidGeoJson(geoJson);
    } catch (e) {
        logger.warn({
            method: "DisruptionsService.validateGeoJson",
            message: "invalid GeoJSON"
        });

        logger.debug(geoJson);

        return false;
    }
}

export function convertFeature(disruption: DisruptionsDB.DbDisruption): Feature {
    const properties: Disruption = {
        Id: disruption.id,
        Type_Id: disruption.type_id,
        StartDate: disruption.start_date,
        EndDate: disruption.end_date,
        DescriptionFi: disruption.description_fi,
        DescriptionSv: disruption.description_sv,
        DescriptionEn: disruption.description_en
    };
    // convert geometry from wkb to geojson
    const geometry = Geometry.parse(Buffer.from(disruption.geometry, "hex")).toGeoJSON() as GeoJSONGeometry;
    return {
        type: "Feature",
        properties,
        geometry
    };
}
