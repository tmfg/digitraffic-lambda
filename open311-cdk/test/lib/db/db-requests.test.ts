import * as pgPromise from "pg-promise";
import {find, findAll, update} from "../../../lib/db/db-requests";
import {newServiceRequest} from "../testdata";
import {dbTestBase, insertServiceRequest} from "../db-testutil";
import {ServiceRequestStatus} from "../../../lib/model/service-request";

describe('db-requests', dbTestBase((db: pgPromise.IDatabase<any,any>) => {

    test('findAll', async () => {
        const serviceRequests = Array.from({length: Math.floor(Math.random() * 10)}).map(() => {
            return newServiceRequest();
        });
        await insertServiceRequest(db, serviceRequests);

        const foundServiceRequests = await findAll(db);

        // TODO match object, date millisecond difference
        expect(foundServiceRequests.length).toBe(serviceRequests.length);
    });

    test('find - found', async () => {
        const serviceRequest = newServiceRequest();
        await insertServiceRequest(db, [serviceRequest]);

        const foundServiceRequest = await find(db, serviceRequest.service_request_id);

        expect(foundServiceRequest).toMatchObject(serviceRequest);
    });

    test('find - not found', async () => {
        const foundServiceRequest = await find(db, 'lol');

        expect(foundServiceRequest).toBeNull();
    });

    test('update - delete', async () => {
        const serviceRequest = newServiceRequest();
        await insertServiceRequest(db, [serviceRequest]);

        await update(db, [Object.assign({}, serviceRequest, {
            status: ServiceRequestStatus.closed
        })]);
        const foundServiceRequests = await findAll(db);

        expect(foundServiceRequests.length).toBe(0);
    });

    test('update - modify', async () => {
        const serviceRequest = newServiceRequest();
        await insertServiceRequest(db, [serviceRequest]);

        // round off millis
        const requested_datetime = new Date();
        requested_datetime.setMilliseconds(0);
        const updated_datetime = new Date();
        updated_datetime.setMilliseconds(0);
        const expected_datetime = new Date();
        expected_datetime.setMilliseconds(0);
        const updatingServiceRequest = {
            status_notes: "other status notes",
            service_name: "other service name",
            service_code: "other than 123",
            description: "other description",
            agency_responsible: "other agency",
            service_notice: "other notice",
            requested_datetime,
            updated_datetime,
            expected_datetime,
            address: "other address",
            address_id: "other than 2",
            zipcode: "other than 123456",
            media_url: "other url",
            status_id: '321',
            title: 'another title',
            service_object_id: 'another service_object_id',
            service_object_type: 'another service_object_type',
            media_urls: ['http://doesnotexist.lol']
        };
        await update(db, [Object.assign({}, serviceRequest, updatingServiceRequest)]);
        const foundServiceRequests = await findAll(db);

        expect(foundServiceRequests.length).toBe(1);
        const foundServiceRequest = foundServiceRequests[0];
        expect(foundServiceRequest.status_notes).toBe(updatingServiceRequest.status_notes);
        expect(foundServiceRequest.service_name).toBe(updatingServiceRequest.service_name);
        expect(foundServiceRequest.service_code).toBe(updatingServiceRequest.service_code);
        expect(foundServiceRequest.description).toBe(updatingServiceRequest.description);
        expect(foundServiceRequest.requested_datetime).toMatchObject(updatingServiceRequest.requested_datetime);
        expect(foundServiceRequest.updated_datetime).toMatchObject(updatingServiceRequest.updated_datetime);
        expect(foundServiceRequest.expected_datetime).toMatchObject(updatingServiceRequest.expected_datetime);
        expect(foundServiceRequest.agency_responsible).toBe(updatingServiceRequest.agency_responsible);
        expect(foundServiceRequest.service_notice).toBe(updatingServiceRequest.service_notice);
        expect(foundServiceRequest.address).toBe(updatingServiceRequest.address);
        expect(foundServiceRequest.address_id).toBe(updatingServiceRequest.address_id);
        expect(foundServiceRequest.zipcode).toBe(updatingServiceRequest.zipcode);
        expect(foundServiceRequest.media_url).toBe(updatingServiceRequest.media_url);
        expect(foundServiceRequest.status_id).toBe(updatingServiceRequest.status_id);
        expect(foundServiceRequest.title).toBe(updatingServiceRequest.title);
        expect(foundServiceRequest.service_object_id).toBe(updatingServiceRequest.service_object_id);
        expect(foundServiceRequest.service_object_type).toBe(updatingServiceRequest.service_object_type);
        expect(foundServiceRequest.media_urls).toMatchObject(updatingServiceRequest.media_urls);
    });

    test("update - null geometry doesn't fail", async () => {
        const serviceRequest = newServiceRequest();
        await insertServiceRequest(db, [serviceRequest]);

        const updatingServiceRequest = Object.assign({}, serviceRequest);
        // @ts-ignore
        delete updatingServiceRequest.long;
        // @ts-ignore
        delete updatingServiceRequest.lat;
        await update(db, [updatingServiceRequest]);
    });

    test('Insert', async () => {
        const serviceRequests = Array.from({length: Math.floor(Math.random() * 10)}).map(() => {
            return newServiceRequest();
        });

        await update(db, serviceRequests);
        const foundServiceRequests = await findAll(db);

        expect(foundServiceRequests.length).toBe(serviceRequests.length);
    });

    test("Insert - null geometry doesn't fail", async () => {
        const serviceRequest = newServiceRequest();
        // @ts-ignore
        delete serviceRequest.long;
        // @ts-ignore
        delete serviceRequest.lat;

        await update(db, [serviceRequest]);
    });

}));