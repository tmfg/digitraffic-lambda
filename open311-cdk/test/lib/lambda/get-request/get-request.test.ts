import * as pgPromise from "pg-promise";
import {handler} from "../../../../lib/lambda/get-request/lambda-get-request";
import {newServiceRequest} from "../../testdata";
import {ServiceRequestStatus} from "../../../../lib/model/service-request";
import {dbTestBase, insertServiceRequest} from "../../db-testutil";
const testEvent = require('../../test-event');

describe('lambda-get-request', dbTestBase((db: pgPromise.IDatabase<any,any>) => {

    test('No request_id - invalid request', async () => {
        const response = await handler(Object.assign({}, testEvent, {
            pathParameters: {},
            body: JSON.stringify(newServiceRequest())
        }));

        expect(response.statusCode).toBe(400);
    });

    test('Get', async () => {
        const sr = Object.assign(newServiceRequest(), {
            status: ServiceRequestStatus.open
        });
        await insertServiceRequest(db, [sr]);

        const response = await handler(Object.assign({}, testEvent, {
            pathParameters: {request_id: sr.service_request_id}
        }));

        expect(response.statusCode).toBe(200);
    });

}));