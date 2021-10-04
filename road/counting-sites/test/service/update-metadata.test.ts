import {updateMetadataForDomain} from "../../lib/service/update";
import {dbTestBase, insertCounter, insertDomain, withServer} from "../db-testutil";
import {IDatabase} from "pg-promise";
import {TestHttpServer} from "digitraffic-common/test/httpserver";
import {findAllCounters} from "../../lib/db/counter";
import {URL_ALL_SITES} from "../../lib/api/eco-counter";

const PORT = 8091;

const DOMAIN_NAME = 'TEST_DOMAIN';

describe('update tests', dbTestBase((db: IDatabase<any, any>) => {
    const EMPTY_DATA = JSON.stringify([]);

    async function assertCountersInDb(expected: number, fn?: any) {
        const counters = await findAllCounters(db);
        expect(counters).toHaveLength(expected);

        if(fn) {
            fn(counters);
        }
    }

    async function withServerAllSites(response: string, fn: ((server: TestHttpServer) => any)) {
        return withServer(PORT, URL_ALL_SITES, response, fn);
    }

    test('updateMetadataForDomain - empty', async () => {
        await assertCountersInDb(0);
        await insertDomain(db, DOMAIN_NAME);

        await withServerAllSites(EMPTY_DATA, async (server: TestHttpServer) => {
            await updateMetadataForDomain(DOMAIN_NAME, '', `http://localhost:${PORT}`);

            expect(server.getCallCount()).toEqual(1);
        });

        await assertCountersInDb(0);
    });

    const RESPONSE_ONE_COUNTER = JSON.stringify([{
        name: 'DOMAINNAME',
        channels: [
            {
                id: 1,
                domain: "D",
                name: 'COUNTERNAME',
                latitude: 10,
                longitude: 10,
                userType: 1,
                interval: 15,
                sens: 1
            }
        ]
    }]);

    test('updateMetadataForDomain - insert', async () => {
        await insertDomain(db, DOMAIN_NAME);
        await assertCountersInDb(0);

        await withServerAllSites(RESPONSE_ONE_COUNTER, async (server: TestHttpServer) => {
            await updateMetadataForDomain(DOMAIN_NAME, '', `http://localhost:${PORT}`);

            expect(server.getCallCount()).toEqual(1);
        });

        await assertCountersInDb(1, (counters: any[]) => {
            expect(counters[0].name).toEqual('DOMAINNAME COUNTERNAME');
        });
    });

    test('updateMetadataForDomain - update', async () => {
        await insertDomain(db, DOMAIN_NAME);
        await insertCounter(db, 1, DOMAIN_NAME, 1);
        await assertCountersInDb(1);

        await withServerAllSites(RESPONSE_ONE_COUNTER, async (server: TestHttpServer) => {
            await updateMetadataForDomain(DOMAIN_NAME, '', `http://localhost:${PORT}`);

            expect(server.getCallCount()).toEqual(1);
        });

        await assertCountersInDb(1);
    });

    test('updateMetadataForDomain - remove', async () => {
        await insertDomain(db, DOMAIN_NAME);
        await insertCounter(db, 1, DOMAIN_NAME, 1);
        await assertCountersInDb(1);

        await withServerAllSites(EMPTY_DATA, async (server: TestHttpServer) => {
            await updateMetadataForDomain(DOMAIN_NAME, '', `http://localhost:${PORT}`);

            expect(server.getCallCount()).toEqual(1);
        });

        await assertCountersInDb(1, (counters: any[]) => {
            expect(counters[0].removed_timestamp).not.toBeNull();
        });
    });
}));
