/* eslint-disable camelcase */
import {
    dbTestBase,
    findAllDomaindContracts,
    findAllTrackings,
    insertDomain,
    insertDomaindContract,
    insertDomaindTaskMapping,
    truncate,
} from "../db-testutil";
import {DTDatabase, inDatabaseReadonly} from "digitraffic-common/database/database";
import {AutoriUpdate, UNKNOWN_TASK_NAME} from "../../lib/service/autori-update";
import {AutoriApi} from "../../lib/api/autori";
import {ApiContractData, ApiOperationData, ApiRouteData} from "../../lib/model/data";
import * as sinon from "sinon";
import {SinonStub} from "sinon";
import {Feature, Geometry, LineString, Position} from "geojson";
import * as utils from "../../lib/service/utils";
import moment from "moment";
import {getRandomNumber, randomString} from "digitraffic-common/test/testutils";
import * as DataDb from "../../lib/db/data";
import {DbDomainContract, DbDomainTaskMapping, DbMaintenanceTracking, DbWorkMachine} from "../../lib/model/db-data";
import * as LastUpdatedDb from "digitraffic-common/database/last-updated";
import {DataType} from "digitraffic-common/database/last-updated";
import {AUTORI_MAX_MINUTES_TO_HISTORY} from "../../lib/constants";


const DOMAIN_1 = 'autori-oulu';
const SOURCE_1 = 'Autori / Oulu';

const VEHICLE_TYPE = 'my-vehicle-type';
const CONTRACT_ID = 'my-contract-1';

const HARJA_BRUSHING = 'BRUSHING';
const HARJA_PAVING = 'PAVING';
const HARJA_SALTING = 'SALTING';

const OPERATION_BRUSHNG = 'task1';
const OPERATION_PAVING = 'task2';
const OPERATION_SALTING = 'task3';

const X_MIN = 19.0;
const X_MAX = 32.0;
const Y_MIN = 59.0;
const Y_MAX = 72.0;

const autoriUpdateService = createAutoriUpdateService();

function createAutoriUpdateService() {
    return new AutoriUpdate(AutoriApi.prototype);
}

describe('autori-update-service-test', dbTestBase((db: DTDatabase) => {

    afterEach(async () => {
        sinon.restore();
        await truncate(db);
    });

    test('getTasksForOperations', () => {
        const taskMappings = [
            // Map domain operations to harja tasks
            createTaskMapping(DOMAIN_1, HARJA_BRUSHING, OPERATION_BRUSHNG, false),
            createTaskMapping(DOMAIN_1, HARJA_PAVING, OPERATION_PAVING, true),
            createTaskMapping(DOMAIN_1, HARJA_SALTING, OPERATION_SALTING, false),
        ];

        const tasks : string[] = autoriUpdateService.getTasksForOperations([OPERATION_BRUSHNG, OPERATION_PAVING], taskMappings);

        expect(tasks).toHaveLength(1);
        expect(tasks).toContain(HARJA_BRUSHING);
    });

    test('getLatestUpdatedDateForRouteData', () => {
        const past1h = moment().subtract(1, 'hour').toDate();
        const future1h = moment().add(1, 'hour').toDate();
        const route : ApiRouteData[] = [createApiRouteData(past1h, []), createApiRouteData(future1h, [])];
        const latest = autoriUpdateService.getLatestUpdatedDateForRouteData(route);
        expect(latest).toEqual(future1h);
    });

    test('createDbWorkMachine', () => {
        const wm : DbWorkMachine = autoriUpdateService.createDbWorkMachine(CONTRACT_ID, DOMAIN_1, VEHICLE_TYPE);
        expect(wm.harjaUrakkaId).toEqual(utils.createHarjaId(CONTRACT_ID));
        expect(wm.harjaId).toEqual(utils.createHarjaId(VEHICLE_TYPE));
        expect(wm.type).toContain(CONTRACT_ID);
        expect(wm.type).toContain(VEHICLE_TYPE);
        expect(wm.type).toContain(DOMAIN_1);
    });


    test('createDbDomainContracts', () => {
        const CONTRACT_1 = 'contract1';
        const CONTRACT_2 = 'contract2';
        const apiContracts : ApiContractData[] = [createApiContractData(CONTRACT_1), createApiContractData(CONTRACT_2)];
        const contracts = autoriUpdateService.createDbDomainContracts(apiContracts, DOMAIN_1);
        expect(contracts).toHaveLength(2);
        expect(contracts.find(c => c.name == CONTRACT_1)?.contract).toEqual(apiContracts[0].id);
        expect(contracts.find(c => c.name == CONTRACT_2)?.contract).toEqual(apiContracts[1].id);
    });

    test('createDbMaintenanceTracking', () => {
        const workMachineId = 1;
        const now = moment().toDate();
        const geometries : LineString[] = createLineStringGeometries(2,5);
        const route : ApiRouteData = createApiRouteData(now, geometries);
        const dbContract = createDbDomainContract("contract-1", DOMAIN_1);
        const trackings : DbMaintenanceTracking[] = autoriUpdateService.createDbMaintenanceTracking(workMachineId, route, dbContract, [HARJA_BRUSHING, HARJA_SALTING]);

        // Expect all geometries to be found
        expect(trackings.length).toEqual(geometries.length); // same as geometries count
        geometries.forEach(g => {
            const t : DbMaintenanceTracking | undefined = trackings.find(tr => parseLineString(tr.line_string).coordinates[0][0] == g.coordinates[0][0]);
            const ls = parseLineString(t?.line_string);
            expect(ls.coordinates[0][1]).toEqual(g.coordinates[0][1]);
            console.info(`Found ${JSON.stringify(ls)}`);
            expect(t?.start_time).toEqual(createTrackingStartTimeFromUpdatedTime(now));
            expect(t?.end_time).toEqual(createTrackingEndTimeFromUpdatedTime(now));
        });
    });

    test('createDbMaintenanceTracking empty tasks', () => {
        const route : ApiRouteData = createApiRouteData(new Date(), createLineStringGeometries(2,5));
        const dbContract = createDbDomainContract("contract-1", DOMAIN_1);
        const trackings : DbMaintenanceTracking[] = autoriUpdateService.createDbMaintenanceTracking(1, route, dbContract, []);

        expect(trackings.length).toEqual(0); // No tasks -> no trackings
    });

    test('createDbDomainTaskMappings', () => {
        const operations = [createApiOperationData(OPERATION_BRUSHNG, DOMAIN_1),createApiOperationData(OPERATION_PAVING, DOMAIN_1)];
        const mappings : DbDomainTaskMapping[] = autoriUpdateService.createDbDomainTaskMappings(operations, DOMAIN_1);

        expect(mappings.length).toEqual(2);
        mappings.forEach((mapping, index) => {
            expect(mapping.ignore).toEqual(true);
            expect(mapping.domain).toEqual(DOMAIN_1);
            expect(mapping.name).toEqual(UNKNOWN_TASK_NAME);
            expect(mapping.original_id).toEqual(operations[index].id);
        });
    });


    test('resolveNextStartTimeForDataFetchFromHistory', () => {
        const lastUdated = moment().subtract(1, 'minutes').toDate();
        const contract = {
            contract: CONTRACT_ID,
            data_last_updated: lastUdated,
            domain: DOMAIN_1,
            start_date: moment().subtract(30, 'days').toDate(),
            end_date: moment().add(30, 'days').toDate(),
            name: "Urakka 1",
            source: "Foo / Bar",
        } as DbDomainContract;
        const resolved = autoriUpdateService.resolveNextStartTimeForDataFetchFromHistory(contract);
        expect(resolved).toEqual(lastUdated);
    });

    test('resolveNextStartTimeForDataFetchFromHistory over 12 month', () => {
        // max from 1.1.2022 or < 12 months - 1h
        const shouldResolveTo = moment().subtract(AUTORI_MAX_MINUTES_TO_HISTORY, 'minutes').toDate();

        const lastUdated = moment().subtract(13, 'months').toDate();
        const contract = {
            contract: CONTRACT_ID,
            data_last_updated: lastUdated,
            domain: DOMAIN_1,
            start_date: moment().subtract(30, 'days').toDate(),
            end_date: moment().add(30, 'days').toDate(),
            name: "Urakka 1",
            source: "Foo / Bar",
        } as DbDomainContract;
        const resolved = autoriUpdateService.resolveNextStartTimeForDataFetchFromHistory(contract);
        expectToBeCloseTo(resolved.getTime(), shouldResolveTo.getTime(), 10000);
    });

    test('resolveNextStartTimeForDataFetchFromHistory start date', () => {
        const startDate = moment().subtract(2, 'minutes').toDate();
        const contract = {
            contract: CONTRACT_ID,
            data_last_updated: undefined,
            domain: DOMAIN_1,
            start_date: startDate,
            end_date: moment().add(30, 'days').toDate(),
            name: "Urakka 1",
            source: "Foo / Bar",
        } as DbDomainContract;
        const resolved = autoriUpdateService.resolveNextStartTimeForDataFetchFromHistory(contract);
        expect(resolved).toEqual(startDate);
    });

    test('resolveNextStartTimeForDataFetchFromHistory fall back', () => {
        const fallBackMin = moment().subtract(AUTORI_MAX_MINUTES_TO_HISTORY, 'minutes').subtract(1, 'seconds').toDate().getTime();
        const fallBackMax = moment().subtract(AUTORI_MAX_MINUTES_TO_HISTORY, 'minutes').add(1, 'seconds').toDate().getTime();
        const contract = {
            contract: CONTRACT_ID,
            data_last_updated: undefined,
            domain: DOMAIN_1,
            start_date: undefined,
            end_date: undefined,
            name: "Urakka 1",
            source: "Foo / Bar",
        } as DbDomainContract;
        const resolved = autoriUpdateService.resolveNextStartTimeForDataFetchFromHistory(contract);
        console.info(`min ${fallBackMin} actual ${resolved.getTime()} max ${fallBackMax}`);
        expect(resolved.getTime()).toBeGreaterThanOrEqual(fallBackMin);
        expect(resolved.getTime()).toBeLessThanOrEqual(fallBackMax);
    });

    test('updateTasks', async () => {
        await insertDomain(db, DOMAIN_1, SOURCE_1);

        const operations = [
            createApiOperationData(OPERATION_BRUSHNG, DOMAIN_1),
            createApiOperationData(OPERATION_PAVING, DOMAIN_1),
        ];
        mockGetOperationsApiResponse(operations);

        await autoriUpdateService.updateTasks(DOMAIN_1);

        const taskMappings1: DbDomainTaskMapping[] = await inDatabaseReadonly((ro: DTDatabase) => {
            return DataDb.getTaskMappings(ro, DOMAIN_1);
        });

        expect(taskMappings1.length).toEqual(2);
        expect(taskMappings1[0].name).toEqual(UNKNOWN_TASK_NAME);
        expect(taskMappings1[1].name).toEqual(UNKNOWN_TASK_NAME);
        expect(taskMappings1.find(t => t.original_id == OPERATION_BRUSHNG)?.domain).toEqual(DOMAIN_1);
        expect(taskMappings1.find(t => t.original_id == OPERATION_PAVING)?.domain).toEqual(DOMAIN_1);
    });

    test('updateTasks existing not changed', async () => {
        await insertDomain(db, DOMAIN_1, SOURCE_1);
        await insertDomaindTaskMapping(
            db, HARJA_SALTING ,OPERATION_BRUSHNG, DOMAIN_1, false,
        );

        const operations = [
            createApiOperationData(OPERATION_BRUSHNG, DOMAIN_1),
        ];
        mockGetOperationsApiResponse(operations);

        await autoriUpdateService.updateTasks(DOMAIN_1);

        const taskMappings1: DbDomainTaskMapping[] = await inDatabaseReadonly((ro: DTDatabase) => {
            return DataDb.getTaskMappings(ro, DOMAIN_1);
        });

        expect(taskMappings1.length).toEqual(1);
        expect(taskMappings1[0].name).toEqual(HARJA_SALTING);
        expect(taskMappings1[0].ignore).toEqual(false);
        expect(taskMappings1[0].domain).toEqual(DOMAIN_1);
        expect(taskMappings1[0].original_id).toEqual(OPERATION_BRUSHNG);
    });

    test('updateContracts', async () => {
        const contract1Name = "Urakka 1";
        const contract2Name = "Urakka 2";
        const contract1NewEndDate = moment().add(1, 'years').toDate();
        const contracts = [
            createApiContractData(contract1Name, contract1NewEndDate),
            createApiContractData(contract2Name),
        ];
        await insertDomain(db, DOMAIN_1, SOURCE_1);

        // Insert one exiting contract with endin date today
        const contract1 = contracts[0];
        await insertDomaindContract(
            db, DOMAIN_1, contract1.id, contract1.name, SOURCE_1, contract1.startDate,
            new Date(),
        );

        // api responses with existing contract (with a new end date) and a new one
        mockGetContractsApiResponse(contracts);

        await autoriUpdateService.updateContracts(DOMAIN_1);

        // We should only get the existing with updated end date as the new one don't have source
        const contractsWithSouce: DbDomainContract[] = await inDatabaseReadonly((ro: DTDatabase) => {
            return DataDb.getContractsWithSource(ro, DOMAIN_1);
        });


        expect(contractsWithSouce.length).toEqual(1);
        expect(contractsWithSouce[0].contract).toEqual(contract1.id);
        expect(contractsWithSouce[0].domain).toEqual(DOMAIN_1);
        expect(contractsWithSouce[0].name).toEqual(contract1Name);
        expect(contractsWithSouce[0].source).toEqual(SOURCE_1);
        expect(contractsWithSouce[0].end_date).toEqual(contract1NewEndDate);

        const all = await findAllDomaindContracts(db, DOMAIN_1);
        const dbContract2 = all.find(c => c.contract == contracts[1].id);
        expect(dbContract2?.name).toEqual(contract2Name);
        expect(dbContract2?.source).toBeNull();
    });

    test('updateTrackings', async () => {
        const contractName = "Urakka 1";
        const past3 = moment().subtract(6, 'minutes').toDate();
        const past2 = moment().subtract(4, 'minutes').toDate();
        const past1 = moment().subtract(2, 'minutes').toDate();

        await insertDomain(db, DOMAIN_1, SOURCE_1);
        await insertDomaindContract(
            db, DOMAIN_1, CONTRACT_ID, contractName, SOURCE_1, moment().subtract(1, 'months').toDate(),
            moment().add(1, 'months').toDate(), past3,
        );
        await insertDomaindTaskMapping(
            db, HARJA_BRUSHING ,OPERATION_BRUSHNG, DOMAIN_1, false,
        );
        await insertDomaindTaskMapping(
            db, HARJA_PAVING ,OPERATION_PAVING, DOMAIN_1, false,
        );

        // Create two routes, 2 days and 1 day old
        const route2d: ApiRouteData = createApiRouteData(past2, createLineStringGeometries(1, 1), [OPERATION_BRUSHNG]);
        const route1d: ApiRouteData = createApiRouteData(past1, createLineStringGeometries(1, 1), [OPERATION_PAVING]);

        // Sub api to return those routes
        const stub = getStubForGetNextRouteDataForContract();
        mockGetNextRouteDataForContractApiResponse(stub, CONTRACT_ID, past3, [route2d]);
        mockGetNextRouteDataForContractApiResponse(stub, CONTRACT_ID, past2, [route1d]);
        mockGetNextRouteDataForContractApiResponse(stub, CONTRACT_ID, past1, []);

        await autoriUpdateService.updateTrackingsForDomain(DOMAIN_1);

        const trackings = await findAllTrackings(db, DOMAIN_1);
        expect(trackings.length).toEqual(2);
        const olderTracking = trackings.find(t => t.message_original_id == route2d.id);
        const latestTracking = trackings.find(t => t.message_original_id == route1d.id);

        expect(olderTracking?.tasks.length).toEqual(1);
        expect(olderTracking?.tasks).toContain(HARJA_BRUSHING);
        expect(olderTracking?.start_time).toEqual(createTrackingStartTimeFromUpdatedTime(past2));
        expect(olderTracking?.end_time).toEqual(createTrackingEndTimeFromUpdatedTime(past2));

        expect(latestTracking?.tasks.length).toEqual(1);
        expect(latestTracking?.tasks).toContain(HARJA_PAVING);
        expect(latestTracking?.start_time).toEqual(createTrackingStartTimeFromUpdatedTime(past1));
        expect(latestTracking?.end_time).toEqual(createTrackingEndTimeFromUpdatedTime(past1));

        const checked = await LastUpdatedDb.getLastUpdated(db, DataType.MAINTENANCE_TRACKING_DATA_CHECKED);
        const updated = await LastUpdatedDb.getLastUpdated(db, DataType.MAINTENANCE_TRACKING_DATA);
        expectToBeCloseTo(<number>checked?.getTime(), Date.now(), 500);
        expectToBeCloseTo(<number>updated?.getTime(), Date.now(), 500);
    });



    // test('saveTrackings', async () => {
    //     const contractName = "Urakka 1";
    //     const contract = createApiContractData(contractName);
    //     await insertDomain(db, DOMAIN_1, SOURCE_1);
    //     await insertDomaindContract(
    //         db, DOMAIN_1, contract.id, contract.name, SOURCE_1, contract.startDate,
    //         contract.endDate, undefined,
    //     );
    //     const dbContract = await getDomaindContract(db, DOMAIN_1, contract.id);
    //
    //     // ignore OPERATION_PAVING
    //     const dbTaskMappings: DbDomainTaskMapping[] = [
    //         createDbDomainTaskMapping(HARJA_BRUSHING, OPERATION_BRUSHNG, DOMAIN_1, false),
    //         createDbDomainTaskMapping(HARJA_SALTING, OPERATION_SALTING, DOMAIN_1, false),
    //         createDbDomainTaskMapping(HARJA_PAVING, OPERATION_PAVING, DOMAIN_1, true),
    //     ];
    //
    //
    //     // contract: DbDomainContract, routeData: ApiRouteData[], taskMappings: DbDomainTaskMapping[]) : Promise<TrackingSaveResult> {
    //     const updated = new Date();
    //     const route: ApiRouteData[] = [
    //         // this is not ignored as OPERATION_BRUSHNG is accepted
    //         createApiRouteData(updated, createLineStringGeometries(1, 1), [OPERATION_PAVING, OPERATION_BRUSHNG]),
    //         createApiRouteData(updated, createLineStringGeometries(1, 1), [OPERATION_SALTING, OPERATION_BRUSHNG]),
    //         // This will be ignored
    //         createApiRouteData(updated, createLineStringGeometries(1, 1), [OPERATION_PAVING]),
    //     ];
    //
    //     await autoriUpdateService.saveTrackings(dbContract, route, dbTaskMappings);
    //
    //     const trackings = await findAllTrackings(db, DOMAIN_1);
    //
    //     expect(trackings.length).toEqual(2);
    //     const first = trackings.find(t => t.message_original_id == route[0].id);
    //     const second = trackings.find(t => t.message_original_id == route[1].id);
    //
    //     expect(first?.tasks.length).toEqual(1);
    //     expect(first?.tasks).toContain(HARJA_BRUSHING);
    //
    //     expect(second?.tasks.length).toEqual(2);
    //     expect(second?.tasks).toContain(HARJA_SALTING);
    //     expect(second?.tasks).toContain(HARJA_BRUSHING);
    //
    //     console.info(JSON.stringify(trackings));
    // });



    function mockGetOperationsApiResponse(response: ApiOperationData[]) {
        return sinon.stub(AutoriApi.prototype, 'getOperations').returns(Promise.resolve(response));
    }

    function mockGetContractsApiResponse(response: ApiContractData[]) {
        return sinon.stub(AutoriApi.prototype, 'getContracts').returns(Promise.resolve(response));
    }

    function getStubForGetNextRouteDataForContract() : SinonStub {
        return sinon.stub(AutoriApi.prototype, 'getNextRouteDataForContract');
    }

    function mockGetNextRouteDataForContractApiResponse(stub: SinonStub, contract : string, from: Date, response: ApiRouteData[]) {
        console.info(`mockGetNextRouteDataForContractApiResponse ${contract}, ${from.toISOString()}, 1`);
        stub.withArgs(contract, from, 1).returns(Promise.resolve(response));
    }


    function createTaskMapping(domain : string, harjaTask : string, domainOperation : string, ignore : boolean) : DbDomainTaskMapping {
        return {
            name: harjaTask,
            domain: domain,
            ignore: ignore,
            original_id: domainOperation,
        };
    }

    function createApiContractData(name: string, endDate = moment().add(30, 'days').toDate()) : ApiContractData {
        return {
            id: randomString(),
            name: name,
            startDate: moment().subtract(30, 'days').toDate(),
            endDate: endDate,
        };
    }

    function createDbDomainContract(contract : string, domain : string, dataLastUpdated?:Date) : DbDomainContract {
        return {
            contract: contract,
            data_last_updated: dataLastUpdated,
            domain: domain,
            start_date: moment().subtract(30, 'days').toDate(),
            end_date: moment().add(30, 'days').toDate(),
            name: "Urakka 1",
            source: "Foo / Bar",
        };
    }


    function createLineString(coordinates: Position[]) : LineString {
        return {
            type: "LineString",
            coordinates: coordinates,
        };
    }

    function createApiRouteData(updated : Date, geometries : Geometry[], operations:string[]=[OPERATION_BRUSHNG, OPERATION_PAVING, OPERATION_SALTING]) : ApiRouteData {

        const features : Feature[] = createApiRoutedataFeatures(geometries);
        return {
            vehicleType: VEHICLE_TYPE,
            geography: {
                features: features,
                type: "FeatureCollection",
            },
            created: new Date(),
            updated: updated,
            id: randomString(),
            startTime: createTrackingStartTimeFromUpdatedTime(updated),
            endTime: createTrackingEndTimeFromUpdatedTime(updated),
            operations: operations,
        };
    }

    function createTrackingStartTimeFromUpdatedTime(updatedTime : Date) : Date {
        return moment(updatedTime).subtract(5, 'minutes').toDate();
    }

    function createTrackingEndTimeFromUpdatedTime(updatedTime : Date) : Date {
        return moment(updatedTime).subtract(1, 'minutes').toDate();
    }

    function createApiRoutedataFeatures(geometries : Geometry[]) : Feature[] {
        return Array.from({length: geometries.length}, (_, i) => {
            return {
                type: "Feature",
                geometry: geometries[i],
                properties: {
                    streetAddress: "Patukatu 1-10, Oulu",
                    featureType: "StreetAddress",
                },
            };
        });
    }

    function parseLineString(lineString? : string) : LineString {
        if (lineString) {
            return JSON.parse(lineString) as LineString;
        }
        throw new Error('No lineString given!');
    }

    function createLineStringGeometries(minCount: number, maxCount: number) : LineString[]  {
        return Array.from({length: getRandomNumber(minCount, maxCount)}, () => {
            return createLineString([
                [getRandomNumber(X_MIN, X_MAX), getRandomNumber(Y_MIN, Y_MAX)],
                [getRandomNumber(X_MIN, X_MAX), getRandomNumber(Y_MIN, Y_MAX)],
            ]);
        });
    }

    function createApiOperationData(id : string, operationName : string) : ApiOperationData {
        return {
            id: id,
            operationName: operationName,
        };
    }

    // function createDbDomainTaskMapping(name: string, originalId: string, domain: string, ignore: boolean): DbDomainTaskMapping {
    //     return { name: name, original_id: originalId, domain: domain, ignore: ignore };
    // }

    function expectToBeCloseTo(value: number, expected: number, delta: number) {
        expect(expected-value).toBeGreaterThanOrEqual(-1* delta);
        expect(expected-value).toBeLessThanOrEqual(delta);
    }
}));