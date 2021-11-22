import * as SseSchema from "../generated/tlsc-sse-reports-schema";
import * as SseDb from "../db/sse-db";
import {DTDatabase, inDatabase} from 'digitraffic-common/postgres/database';
import * as LastUpdatedDB from "digitraffic-common/db/last-updated";

export const SSE_DATA_DATA_TYPE = "SSE_DATA";

export type SseSaveResult = {
    readonly saved: number
    readonly errors: number
}

export async function saveSseData(sseReport: SseSchema.TheSSEReportRootSchema) : Promise<SseSaveResult> {
    return inDatabase(async (db: DTDatabase) => {
        let saved = 0;
        let errors = 0;

        for (const report of sseReport.SSE_Reports) {
            try {
                const dbSseSseReport = convertToDbSseReport(report);
                await db.tx(t => {
                    return t.batch([
                        SseDb.updateLatestSiteToFalse(t, dbSseSseReport.siteNumber),
                        SseDb.insertSseReportData(t, dbSseSseReport),
                        LastUpdatedDB.updateUpdatedTimestamp(t, SSE_DATA_DATA_TYPE, new Date())
                    ]);
                }).then(() => {
                    saved++;
                    console.info('method=saveSseData succeed');
                }).catch((error) => {
                    errors++;
                    console.error('method=saveSseData update failed', error);
                });
            } catch (e) {
                console.error(`method=saveSseData Error while handling record`, e);
                errors++;
            }
        }
        const result : SseSaveResult = {
            errors,
            saved
        }
        console.info(`method=saveSseData result ${JSON.stringify(result)}`);
        return result;
    }
)}

export function convertToDbSseReport(sseReport: SseSchema.TheItemsSchema) : SseDb.DbSseReport {

    if (!sseReport.Extra_Fields?.Coord_Latitude) {
        throw new Error('Missing Coord_Latitude');
    } else if (!sseReport.Extra_Fields?.Coord_Longitude) {
        throw new Error('Missing Coord_Longitude');
    }

    const data: SseDb.DbSseReport = {
        siteNumber: sseReport.Site.SiteNumber,
        siteName: sseReport.Site.SiteName,
        siteType: sseReport.Site.SiteType,

        lastUpdate: sseReport.SSE_Fields.Last_Update,
        confidence: sseReport.SSE_Fields.Confidence,
        seaState: sseReport.SSE_Fields.SeaState,
        trend: sseReport.SSE_Fields.Trend,
        windWaveDir: sseReport.SSE_Fields.WindWaveDir,

        heelAngle: sseReport.Extra_Fields?.Heel_Angle,
        lightStatus: sseReport.Extra_Fields?.Light_Status,
        temperature: sseReport.Extra_Fields?.Temperature,
        longitude: sseReport.Extra_Fields?.Coord_Longitude ?? -1,
        latitude: sseReport.Extra_Fields?.Coord_Latitude ?? -1
    };
    return data;
}

