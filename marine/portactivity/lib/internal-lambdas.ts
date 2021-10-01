import {AssetCode, Function, Runtime} from '@aws-cdk/aws-lambda';
import {Duration, Stack} from '@aws-cdk/core';
import {dbFunctionProps, defaultLambdaConfiguration} from 'digitraffic-common/stack/lambda-configs';
import {createSubscription} from 'digitraffic-common/stack/subscription';
import {Props} from "./app-props";
import {Queue} from "@aws-cdk/aws-sqs";
import {SqsEventSource} from "@aws-cdk/aws-lambda-event-sources";
import {Bucket} from "@aws-cdk/aws-s3";
import {BUCKET_NAME} from "./lambda/process-dlq/lambda-process-dlq";
import {RetentionDays} from '@aws-cdk/aws-logs';
import {QueueAndDLQ} from "./sqs";
import {PolicyStatement} from "@aws-cdk/aws-iam";
import {Rule, Schedule} from "@aws-cdk/aws-events";
import {LambdaFunction} from "@aws-cdk/aws-events-targets";
import {ISecret} from "@aws-cdk/aws-secretsmanager";
import {PortactivityEnvKeys} from "./keys";
import {LambdaEnvironment} from "digitraffic-common/model/lambda-environment";
import {MonitoredFunction} from "digitraffic-common/lambda/monitoredfunction";
import {DigitrafficStack} from "../../../digitraffic-common/stack/stack";
import {TrafficType} from "digitraffic-common/model/traffictype";

export function create(
    queueAndDLQ: QueueAndDLQ,
    dlqBucket: Bucket,
    secret: ISecret,
    stack: DigitrafficStack) {

    createProcessQueueLambda(queueAndDLQ.queue, secret, stack);
    createProcessDLQLambda(dlqBucket, queueAndDLQ.dlq, stack);

    const updateAwakeAiTimestampsLambda = createUpdateAwakeAiTimestampsLambda(secret, queueAndDLQ.queue, stack);
    const updateScheduleTimestampsLambda = createUpdateTimestampsFromSchedules(secret, queueAndDLQ.queue, stack);

    const updateETASchedulingRule = createETAScheduler(stack);
    updateETASchedulingRule.addTarget(new LambdaFunction(updateAwakeAiTimestampsLambda));
    updateETASchedulingRule.addTarget(new LambdaFunction(updateScheduleTimestampsLambda));

    if((stack.configuration as Props).sources?.pilotweb) {
        const updateTimestampsFromPilotwebLambda = createUpdateTimestampsFromPilotwebLambda(secret, queueAndDLQ.queue, stack);

        const pilotwebScheduler = createPilotwebScheduler(stack);
        pilotwebScheduler.addTarget(new LambdaFunction(updateTimestampsFromPilotwebLambda));
    }
}

function createUpdateTimestampsFromPilotwebLambda(secret: ISecret, queue: Queue, stack: DigitrafficStack): Function {
    const functionName = 'PortActivity-UpdateTimestampsFromPilotweb';
    const environment = stack.createDefaultLambdaEnvironment('PortActivity');
    environment[PortactivityEnvKeys.PORTACTIVITY_QUEUE_URL] = queue.queueUrl;

    const lambda = MonitoredFunction.create(stack, functionName, dbFunctionProps(stack, {
        memorySize: 256,
        reservedConcurrentExecutions: 1,
        timeout: 10,
        functionName,
        code: new AssetCode('dist/lambda/update-timestamps-from-pilotweb'),
        handler: 'lambda-update-timestamps-from-pilotweb.handler',
        environment
    }), TrafficType.MARINE);

    createSubscription(lambda, functionName, stack.configuration.logsDestinationArn, stack);
    queue.grantSendMessages(lambda);

    secret.grantRead(lambda);

    return lambda;
}

// ATTENTION!
// This lambda needs to run in a VPC so that the outbound IP address is always the same (NAT Gateway).
// The reason for this is IP based restriction in another system's firewall.
function createUpdateTimestampsFromSchedules(secret: ISecret, queue: Queue, stack: DigitrafficStack): Function {
    const functionName = 'PortActivity-UpdateTimestampsFromSchedules';
    const environment = stack.createDefaultLambdaEnvironment('PortActivity');
    environment[PortactivityEnvKeys.PORTACTIVITY_QUEUE_URL] = queue.queueUrl;

    const lambda = MonitoredFunction.create(stack, functionName, defaultLambdaConfiguration({
        functionName,
        timeout: 10,
        reservedConcurrentExecutions: 1,
        code: new AssetCode('dist/lambda/update-timestamps-from-schedules'),
        handler: 'lambda-update-timestamps-from-schedules.handler',
        environment,
        vpc: stack.vpc,
        vpcSubnets: stack.vpc.privateSubnets
    }), TrafficType.MARINE);

    createSubscription(lambda, functionName, stack.configuration.logsDestinationArn, stack);
    queue.grantSendMessages(lambda);

    secret.grantRead(lambda);

    return lambda;
}

function createProcessQueueLambda(
    queue: Queue,
    secret: ISecret,
    stack: DigitrafficStack) {

    const functionName = "PortActivity-ProcessTimestampQueue";
    const environment = stack.createDefaultLambdaEnvironment('PortActivity');

    const lambdaConf = dbFunctionProps(stack, {
        functionName,
        memorySize: 128,
        code: new AssetCode('dist/lambda/process-queue'),
        handler: 'lambda-process-queue.handler',
        environment,
        timeout: 10,
        reservedConcurrentExecutions: 8
    });

    const processQueueLambda = MonitoredFunction.create(stack, functionName, lambdaConf, TrafficType.MARINE);

    secret.grantRead(processQueueLambda);
    processQueueLambda.addEventSource(new SqsEventSource(queue));
    createSubscription(processQueueLambda, functionName, stack.configuration.logsDestinationArn, stack);
}

function createProcessDLQLambda(
    dlqBucket: Bucket,
    dlq: Queue,
    stack: DigitrafficStack) {

    const lambdaEnv: LambdaEnvironment = {};
    lambdaEnv[BUCKET_NAME] = dlqBucket.bucketName;

    const functionName = "PortActivity-ProcessTimestampsDLQ";
    const processDLQLambda = MonitoredFunction.create(stack, functionName, {
        runtime: Runtime.NODEJS_12_X,
        logRetention: RetentionDays.ONE_YEAR,
        functionName: functionName,
        code: new AssetCode('dist/lambda/process-dlq'),
        timeout: Duration.seconds(10),
        handler: 'lambda-process-dlq.handler',
        environment: lambdaEnv,
        reservedConcurrentExecutions: 1
    }, TrafficType.MARINE);

    processDLQLambda.addEventSource(new SqsEventSource(dlq));
    createSubscription(processDLQLambda, functionName, stack.configuration.logsDestinationArn, stack);

    const statement = new PolicyStatement();
    statement.addActions('s3:PutObject');
    statement.addActions('s3:PutObjectAcl');
    statement.addResources(dlqBucket.bucketArn + '/*');
    processDLQLambda.addToRolePolicy(statement);
}

function createETAScheduler(stack: Stack): Rule {
    const ruleName = 'PortActivity-ETAScheduler'
    return new Rule(stack, ruleName, {
        ruleName,
        schedule: Schedule.expression('cron(*/10 * * * ? *)') // every 10 minutes
    });
}

function createPilotwebScheduler(stack: Stack): Rule {
    const ruleName = 'PortActivity-PilotwebScheduler'
    return new Rule(stack, ruleName, {
        ruleName,
        schedule: Schedule.expression('cron(*/1 * * * ? *)') // every minute
    });
}

function createUpdateAwakeAiTimestampsLambda(secret: ISecret, queue: Queue, stack: DigitrafficStack): Function {
    const environment = stack.createDefaultLambdaEnvironment('PortActivity');
    environment[PortactivityEnvKeys.PORTACTIVITY_QUEUE_URL] = queue.queueUrl;

    const functionName = 'PortActivity-UpdateAwakeAiTimestamps';
    const lambdaConf = dbFunctionProps(stack, {
        functionName,
        memorySize: 128,
        code: new AssetCode('dist/lambda/update-awake-ai-timestamps'),
        handler: 'lambda-update-awake-ai-timestamps.handler',
        timeout: 30,
        environment,
        reservedConcurrentExecutions: 1
    });
    const lambda = MonitoredFunction.create(stack, functionName, lambdaConf, TrafficType.MARINE);

    secret.grantRead(lambda);
    queue.grantSendMessages(lambda);

    createSubscription(lambda, functionName, stack.configuration.logsDestinationArn, stack);

    return lambda;
}
