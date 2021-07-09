import * as DbTestutil from "../db-testutil";
import * as pgPromise from "pg-promise";
import * as SSESchema from "../../lib/generated/tlsc-sse-reports-schema";
import * as SseUpdateService from "../../lib/service/sse-update-service";
import * as SseDb from "../../lib/db/sse-db";
import * as Testdata from "../testdata";

describe('sse-update-service-test', DbTestutil.dbTestBase((db: pgPromise.IDatabase<any, any>) => {

    test('save report', async () => {
        const sseReport: SSESchema.TheSSEReportRootSchema = Testdata.createSampleData([Testdata.site1, Testdata.site2]);
        const savedCount = await SseUpdateService.saveSseData(sseReport);
        expect(savedCount).toBe(2);

        const sseReportsFromDb: SseDb.DbSseReport[] = await DbTestutil.findAllSseReports(db);
        expect(sseReportsFromDb.length).toBe(2);
    });

    test('replace latest report', async () => {
        const sseReport: SSESchema.TheSSEReportRootSchema = Testdata.createSampleData([Testdata.site1]);
        sseReport.SSE_Reports[0].SSE_Fields.SeaState = "CALM";
        await SseUpdateService.saveSseData(sseReport);
        sseReport.SSE_Reports[0].SSE_Fields.SeaState = "BREEZE";
        await SseUpdateService.saveSseData(sseReport);

        const sseReportsFromDb: SseDb.DbSseReport[] = await DbTestutil.findAllSseReports(db);
        expect(sseReportsFromDb.length).toBe(2);

        expect(sseReportsFromDb[0].latest).toBe(false);
        expect(sseReportsFromDb[1].latest).toBe(true);
        expect(sseReportsFromDb[0].seaState).toBe("CALM");
        expect(sseReportsFromDb[1].seaState).toBe("BREEZE");
    });
}));



