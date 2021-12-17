import moment from "moment-timezone";
import {DbFault} from "../model/fault";
import {Feature, Geometry} from "geojson";
import * as wkx from "wkx";

const YEAR_MONTH_DAY = "YYYY-MM-DD";
const HOUR_MINUTE_SECOND = "HH:MM:SSZ";

const PRODUCTION_AGENCY = {
    'language' : 'fin',
    'text' : 'Finnish Transport Infrastructure Agency',
};

const NAME_OF_SERIES_ATON_FAULTS = 'Finnish ATON Faults';
const NAME_OF_SERIES_NAUTICAL_WARNINGS = 'Finnish Nautical Warnings';

const NODE_S124_DATASET = 'S124:DataSet';
const NODE_MEMBER = 'member';
const NODE_IMEMBER = 'imember';
const NODE_BOUNDED_BY = 'gml:boundedBy';

function createDataSet(id: string): any {
    return {
        'S124:DataSet': {
            '$': {
                'xmlns:S124': "http://www.iho.int/S124/gml/1.0",
                'xsi:schemaLocation': 'http://www.iho.int/S124/gml/1.0 ../../schemas/0.5/S124.xsd',
                'xmlns:xsi': "http://www.w3.org/2001/XMLSchema-instance",
                'xmlns:gml': "http://www.opengis.net/gml/3.2",
                'xmlns:S100': "http://www.iho.int/s100gml/1.0",
                'xmlns:xlink': "http://www.w3.org/1999/xlink",
                'gml:id': id,
            },
        },
    };
}

function createId(
    domain: string, id: number, year: number,
): string {
    return `FI.${domain}.${id}.${year}`;
}

function createUrn(id: string): string {
    return `urn:mrn:s124:${id}.P`;
}

export function convertFault(fault: DbFault): any {
    const faultId = -fault.id;
    const year = fault.entry_timestamp.getFullYear() - 2000;

    const id = createId(
        'AF', faultId, year,
    );
    const urn = createUrn(id);

    const root: any = createDataSet(id);
    const dataSet = root[NODE_S124_DATASET];

    dataSet[NODE_BOUNDED_BY] = createBoundedBy(createCoordinatePair(fault.geometry),createCoordinatePair(fault.geometry));

    dataSet[NODE_IMEMBER] = {
        'S124:S124_NWPreamble': {
            '$': {
                'gml:id' : `PR.${id}`,
            },
            id: urn,
            messageSeriesIdentifier : createMessageSeriesIdentifier(
                NAME_OF_SERIES_ATON_FAULTS, faultId, year,
            ),
            sourceDate: moment(fault.entry_timestamp).format(YEAR_MONTH_DAY),
            generalArea: 'Baltic sea',
            locality : {
                text: fault.fairway_name_fi,
            },
            title:  {
                text : `${fault.aton_type} ${fault.aton_name_fi} Nr. ${fault.aton_id}, ${fault.state}`,
            },
            fixedDateRange : createFixedDateRangeForFault(fault),
            theWarningPart: {
                '$': {
                    'xlink:href': `${id}.1`,
                },
            },
        },
    };

    dataSet[NODE_MEMBER] = {
        'S124:S124_NavigationalWarningPart': {
            '$': {
                'gml:id' : `${id}.1`,
            },
            id: `urn:mrn:s124:${id}.1`,
            geometry: createPointProperty(createCoordinatePair(fault.geometry), id),
            header: {
                '$': {
                    'owns': 'true',
                },
            },
        },
    };

    return root;
}

export function convertWarning(warning: Feature): any {
    const p = warning.properties as any;
    const year = moment(p.creationTime).year() - 2000;
    const warningId = p.id;
    const id = createId(
        'NW', warningId, year,
    );
    const urn = createUrn(id);

    const root = createDataSet(id);
    const dataSet = root[NODE_S124_DATASET];

    dataSet[NODE_BOUNDED_BY] = createBoundedBy('17.0000 55.0000', '32.0000 75.0000');

    //        console.info("properties " + JSON.stringify(p));

    dataSet[NODE_IMEMBER] = {
        'S124:S124_NWPreamble': {
            '$': {
                'gml:id': `PR.${id}`,
            },
            id: urn,
            messageSeriesIdentifier: createMessageSeriesIdentifier(
                NAME_OF_SERIES_NAUTICAL_WARNINGS, warningId, year,
            ),
            sourceDate: moment(p.creationTime).format(YEAR_MONTH_DAY),
            generalArea: 'Baltic sea',
            locality: {
                text: p.areasEn,
            },
            title: {
                text: `${p.typeEn}`,
            },
            fixedDateRange: createFixedDateRangeForWarning(p),
            theWarningPart: {
                '$': {
                    'xlink:href': `${id}.1`,
                },
            },
        },
    };

    dataSet[NODE_MEMBER] = {
        'S124:S124_NavigationalWarningPart': {
            '$': {
                'gml:id': `${id}.1`,
            },
            id: `urn:mrn:s124:${id}.1`,
            geometry: createGeometryForWarning(warning.geometry, id),
            Subject: {
                text: `${p.contentsEn}`,
            },
            header: {
                '$': {
                    'owns': 'true',
                },
            },
        },
    };

    return root;
}

function createBoundedBy(lowerCorner: string, upperCorner: string): any {
    return {
        'gml:Envelope': {
            '$': {
                'srsName': 'EPSG:4326',
            },
            'gml:lowerCorner': lowerCorner,
            'gml:upperCorner': upperCorner,
        },
    };
}

function createFixedDateRangeForWarning(p: any) {
    const vst = moment(p.validityStartTime);

    if (p.validityEndTime) {
        const vet = moment(p.validityEndTime);

        return {
            timeOfDayStart: moment(vst).format(HOUR_MINUTE_SECOND),
            timeOfDayEnd: moment(vet).format(HOUR_MINUTE_SECOND),
            dateStart: {
                date: vst.format(YEAR_MONTH_DAY),
            },
            dateEnd: {
                date: vet.format(YEAR_MONTH_DAY),
            },
        };
    }

    if (p.validityEndTime) {
        return {
            timeOfDayStart: moment(vst).format(HOUR_MINUTE_SECOND),
            dateStart: {
                date: moment(vst).format(YEAR_MONTH_DAY),
            },
        };
    }

    return {};
}

function createFixedDateRangeForFault(fault: DbFault) {
    if (fault.fixed_timestamp) {
        return {
            dateStart: {
                date: moment(fault.entry_timestamp).format(YEAR_MONTH_DAY),
            },
            dateEnd: {
                date: moment(fault.fixed_timestamp).format(YEAR_MONTH_DAY),
            },
        };
    }

    return {
        timeOfDayStart: moment(fault.entry_timestamp).format(HOUR_MINUTE_SECOND),
        dateStart: {
            date: moment(fault.entry_timestamp).format(YEAR_MONTH_DAY),
        },
    };
}

function createGeometryForWarning(geometry: Geometry, id: string) {
    if (geometry.type === 'Point') {
        return createPointProperty(`${geometry.coordinates[0]} ${geometry.coordinates[1]}`, id);
    }

    console.info("not supported geometry type " + geometry.type);
    return {};
}

function createPointProperty(geometry: string, id: string) {
    return {
        'S100:pointProperty' : {
            'S100:Point' : {
                '$' : {
                    'gml:id' : `P.${id}.1`,
                },
                'gml:pos': geometry,
            },
        },
    };
}

function createCoordinatePair(geometry: string) {
    const g = wkx.Geometry.parse(Buffer.from(geometry, "hex")).toGeoJSON() as any;

    return `${g.coordinates[0]} ${g.coordinates[1]}`;
}

function createMessageSeriesIdentifier(
    NameOfSeries: string, warningNumber: number, year: number,
) {
    return {
        NameOfSeries,
        typeOfWarning : 'local',
        warningNumber,
        year,
        productionAgency : PRODUCTION_AGENCY,
        country: 'FI',
    };
}
