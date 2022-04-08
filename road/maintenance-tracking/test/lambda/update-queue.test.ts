import {APIGatewayEvent} from "aws-lambda/trigger/api-gateway-proxy";
import {LambdaResponse} from "digitraffic-common/aws/types/lambda-response";
import * as sinon from 'sinon';
import {SqsProducer} from 'sns-sqs-big-payload';
import {MaintenanceTrackingEnvKeys} from "../../lib/keys";
import * as LambdaUpdateQueue from "../../lib/lambda/update-queue/lambda-update-queue";
import * as SqsBigPayload from "../../lib/service/sqs-big-payload";
import {getRandompId, getTrackingJsonWith3Observations} from "../testdata";

process.env[MaintenanceTrackingEnvKeys.SQS_BUCKET_NAME] = 'sqs-bucket-name';
process.env[MaintenanceTrackingEnvKeys.SQS_QUEUE_URL] = 'https://aws-queue-123';
process.env.AWS_REGION = 'aws-region';


// eslint-disable-next-line @typescript-eslint/no-var-requires
const testEvent: APIGatewayEvent = require('../test-apigw-event');

function createSqsProducerForTest() : SqsProducer {

    return SqsBigPayload.createSqsProducer(`${process.env[MaintenanceTrackingEnvKeys.SQS_QUEUE_URL]}`,
        `${process.env.AWS_REGION}`,
        `${process.env[MaintenanceTrackingEnvKeys.SQS_BUCKET_NAME]}`);
}

describe('update-queue', () => {

    const sandbox = sinon.createSandbox();
    afterEach(() => sandbox.restore());

    test('no records - should reject', async () => {
        const sqsClient: SqsProducer = createSqsProducerForTest();
        const sendMessageStub = sandbox.stub(sqsClient, 'sendJSON').returns(Promise.resolve());

        await expect(() => LambdaUpdateQueue.handlerFn(sqsClient)({...testEvent, body: null}))
            .rejects.toMatchObject(LambdaResponse.badRequest("Empty message"));

        expect(sendMessageStub.notCalled).toBe(true);
    });


    test('single valid record', async () => {
        const jsonString = getTrackingJsonWith3Observations(getRandompId(), getRandompId());
        const sqsClient: SqsProducer = createSqsProducerForTest();
        const sendMessageStub = sandbox.stub(sqsClient, 'sendJSON').returns(Promise.resolve());

        await expect(LambdaUpdateQueue.handlerFn(sqsClient)({...testEvent, body: jsonString }))
            .resolves.toMatchObject(LambdaResponse.ok("OK"));

        expect(sendMessageStub.calledWith(JSON.parse(jsonString))).toBe(true);
    });

    test('invalid record', async () => {
        const json = `invalid json ` + getTrackingJsonWith3Observations(getRandompId(), getRandompId());
        const sqsClient: SqsProducer = createSqsProducerForTest();
        const sendMessageStub = sandbox.stub(sqsClient, 'sendJSON');

        await expect(() => LambdaUpdateQueue.handlerFn(sqsClient)({...testEvent, body: json }))
            .rejects.toMatchObject(LambdaResponse.badRequest("Error while sending message to SQS: SyntaxError: Unexpected token i in JSON at position 0"));

        expect(sendMessageStub.notCalled).toBe(true);
    });
});