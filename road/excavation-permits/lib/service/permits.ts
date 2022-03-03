import {PermitsApi} from "../api/permits";
import {ApiExcavationPermit, DbPermit} from "../model/excavation-permit";
import {PermitResponse, PermitElement} from "../model/permit-xml";
import moment from "moment";
import * as xml2js from 'xml2js';
import {inDatabaseReadonly} from "digitraffic-common/database/database";
import * as ExcavationPermitsDAO  from "../db/excavation-permit";
import {Geometry, Point} from "geojson";

const API_URL = "https://lahti.infraweb.fi:1880";
const PERMITS_PATH = "/api/v1/kartat/luvat/voimassa";

export async function getExcavationPermits(authKey: string): Promise<ApiExcavationPermit[]> {
    const api = new PermitsApi(API_URL, PERMITS_PATH, authKey);
    const xmlPermits = await api.getPermitsXml();
    const jsonPermits = await xmlToJs(xmlPermits);
    return jsonPermits["wfs:FeatureCollection"]["gml:featureMember"]
        .filter(permitElement => isValidExcavationPermit(permitElement))
        .map(permitElement => convertPermit(permitElement));
}

export function findPermitsInGeojson() {
    return inDatabaseReadonly(db => {
        return ExcavationPermitsDAO.getActivePermitsGeojson(db);
    });
}

export function findPermitsInD2Light() {
    return inDatabaseReadonly(db => {
        return ExcavationPermitsDAO.getActivePermits(db).then(permits => convertD2Light(permits));
    });
}

function convertD2Light(permits: DbPermit[]) {
    const situationRecord = permits.map(permit => (
        {
            "id": permit.id,
            "version": permit.version,
            "creationTime": permit.createdAt,
            "versionTime": permit.updatedAt,
            "startTime": permit.effectiveFrom,
            "endTime": permit.effectiveTo,
            "type": {
                "value": "maintenanceWork",
            },
            "detailedTypeText": permit.subject,
            "severity": "Medium",
            "safetyRelatedMessage": false,
            "sourceName": "Lahden kaupunki",
            "generalPublicComment": permit.subject,
            "situationId": permit.id,
            "location": convertLocation(permit.geometry),
        }
    ));

    return {
        "modelBaseVersion": "3",
        "situationPublicationLight": {
            "lang": "fi",
            "publicationTime": new Date(),
            "publicationCreator": {
                "country": "fi",
                "nationalIdentifier": "Fintraffic",
            },
            situationRecord,
        },
    };
}

function convertLocation(geometry: Geometry) {
    if (geometry.type === 'Point') {
        return {
            coordinatesForDisplay: {
                latitude: geometry.coordinates[1],
                longitude: geometry.coordinates[0],
            },
        };
    }

    if (geometry.type === 'Polygon') {
        return {
            area: {
                "gmlPolygon": [
                    {
                        "exterior": {
                            "srsName": "ESPG:3011",
                            "posList": geometry.coordinates.join(' '),
                        },
                    },
                ],
            },
        };
    }

    throw new Error("unknown geometry type " + JSON.stringify(geometry));
}

function isValidExcavationPermit(permitElement: PermitElement): boolean {
    return permitElement["GIS:YlAlLuvat"]["GIS:Lupatyyppi"] === "Kaivulupa"
        && permitElement["GIS:YlAlLuvat"]["GIS:VoimassaolonAlkamispaiva"] != null;
}

function convertPermit(permitElement: PermitElement): ApiExcavationPermit {
    const permitObject = permitElement["GIS:YlAlLuvat"];
    return <ApiExcavationPermit>({
        id: permitObject["GIS:Id"],
        subject: permitObject["GIS:LuvanTarkoitus"],
        gmlGeometryXmlString: jsToXml(permitObject["GIS:Geometry"]),
        effectiveFrom: moment(`${permitObject["GIS:VoimassaolonAlkamispaiva"]} ${permitObject["GIS:VoimassaolonAlkamisaika"]}`, "DD.MM.YYYY HH:mm").toDate(),
        effectiveTo: permitObject["GIS:VoimassaolonPaattymispaiva"] != null ?
            moment(`${permitObject["GIS:VoimassaolonPaattymispaiva"]} ${permitObject["GIS:VoimassaolonPaattymissaika"]}`, "DD.MM.YYYY HH:mm").toDate()
            : null,
    });
}

function xmlToJs(xml: string): Promise<PermitResponse> {
    return xml2js.parseStringPromise(xml, {explicitArray: false});
}

function jsToXml(obj: Record<string, unknown>): string {
    const builder = new xml2js.Builder({headless: true, renderOpts: {pretty: false}});
    const xmlString = builder.buildObject(obj);
    return xmlString;
}
