import {DTDatabase, DTTransaction} from "../../../../digitraffic-common/database/database";
import {PreparedStatement} from "pg-promise";
import {ApiExcavationPermit, DbPermit} from "../model/excavation-permit";
import {FeatureCollection, Geometry as GeoJSONGeometry} from "geojson";
import {Geometry} from "wkx";

const SQL_INSERT_PERMIT =
    `INSERT INTO excavation_permit (id, version, permit_type, subject, geometry, effective_from, effective_to, created_at, updated_at)
     VALUES ($1, 1, $2, $3, ST_Transform(ST_GeomFromGML($4), 4326), $5, $6, NOW(), NOW())`;

const SQL_FIND_ALL_PERMITS_GEOJSON =
    `select json_build_object(
        'type', 'FeatureCollection',
        'features', coalesce(json_agg(
             json_build_object(
                     'type', 'Feature',
                     'geometry', ST_AsGeoJSON(geometry::geometry)::json,
                     'properties', json_build_object(
                         'id', id,
                         'version', version,
                         'permitType', permit_type,
                         'subject', subject,
                         'effectiveFrom', effective_from,
                         'effectiveTo', effective_to,
                         'createdAt', created_at,
                         'updatedAt', updated_at
                     )
                 )
             ), '[]')
        ) as collection
     from excavation_permit`;


const SQL_FIND_ALL_PERMITS =
    `select id, version, permit_type, subject, geometry, effective_from, effective_to, created_at, updated_at
     from excavation_permit`;

const SQL_FIND_ALL_PERMIT_IDS = "SELECT id FROM excavation_permit";

const PS_INSERT_PERMIT = new PreparedStatement({
    name: 'insert-permit',
    text: SQL_INSERT_PERMIT,
});

const PS_FIND_ALL_GEOJSON = new PreparedStatement({
    name: 'find-all-permits-geojson',
    text: SQL_FIND_ALL_PERMITS_GEOJSON,
});

const PS_FIND_ALL = new PreparedStatement({
    name: 'find-all-permits',
    text: SQL_FIND_ALL_PERMITS,
});

const PS_FIND_ALL_IDS = new PreparedStatement({
    name: 'find-all-permit-ids',
    text: SQL_FIND_ALL_PERMIT_IDS,
});

export function insertPermits(db: DTTransaction, permits: ApiExcavationPermit[]): Promise<null[]> {
    return Promise.all(permits
        .map(permit => db.none(PS_INSERT_PERMIT,
            [permit.id, permit.permitType, permit.subject, permit.gmlGeometryXmlString, permit.effectiveFrom, permit.effectiveTo])));
}

export function getActivePermitsGeojson(db: DTDatabase): Promise<FeatureCollection> {
    return db.one(PS_FIND_ALL_GEOJSON).then(result => result.collection);
}

export function getActivePermits(db: DTDatabase): Promise<DbPermit[]> {
    return db.manyOrNone(PS_FIND_ALL).then(results => results.map(result => ({
        id: result.id,
        version: result.version,
        permitType: result.permit_type,
        subject: result.subject,
        geometry: Geometry.parse(Buffer.from(result.geometry, "hex")).toGeoJSON() as GeoJSONGeometry,
        effectiveFrom: result.effective_from,
        effectiveTo: result.effective_to,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
    } as DbPermit)));
}

export function getAllPermitIds(db: DTDatabase): Promise<Record<string, string>[]> {
    return db.manyOrNone(PS_FIND_ALL_IDS);
}