import {Function,AssetCode,Runtime} from '@aws-cdk/aws-lambda';
import {IVpc,ISecurityGroup} from '@aws-cdk/aws-ec2';
import {Stack} from '@aws-cdk/core';
import {dbLambdaConfiguration} from '../../../common/stack/lambda-configs';
import {createSubscription} from '../../../common/stack/subscription';
import {Props} from "./app-props";
import {Queue} from "@aws-cdk/aws-sqs";
import {SqsEventSource} from "@aws-cdk/aws-lambda-event-sources";
import {Bucket} from "@aws-cdk/aws-s3";
import {BUCKET_NAME} from "./lambda/process-dlq/lambda-process-dlq";
import {RetentionDays} from '@aws-cdk/aws-logs';
import {QueueAndDLQ} from "./sqs";
import {PolicyStatement} from "@aws-cdk/aws-iam";
import {Topic} from "@aws-cdk/aws-sns";
import {Rule, Schedule} from "@aws-cdk/aws-events";
import {LambdaFunction} from "@aws-cdk/aws-events-targets";
import {
    KEY_ENDPOINT_AUDIENCE, KEY_ENDPOINT_AUTH_URL,
    KEY_ENDPOINT_CLIENT_ID,
    KEY_ENDPOINT_CLIENT_SECRET, KEY_ENDPOINT_URL, KEY_ESTIMATE_SOURCE, KEY_ESTIMATE_SNS_TOPIC_ARN
} from "./lambda/update-eta-timestamps/lambda-update-eta-timestamps";

export function create(
    queueAndDLQ: QueueAndDLQ,
    dlqBucket: Bucket,
    vpc: IVpc,
    lambdaDbSg: ISecurityGroup,
    props: Props,
    stack: Stack) {

    const timestampsUpdatedTopicId = 'PortActivity-TimestampsUpdatedTopic';
    const timestampsUpdatedTopic = new Topic(stack, timestampsUpdatedTopicId, {
        displayName: timestampsUpdatedTopicId,
        topicName: timestampsUpdatedTopicId
    });
    createProcessQueueLambda(queueAndDLQ.queue, timestampsUpdatedTopic, vpc, lambdaDbSg, props, stack);
    createProcessDLQLambda(dlqBucket, queueAndDLQ.dlq, props, stack);

    const updateETATimestampsLambda = createUpdateETATimestampsLambda(timestampsUpdatedTopic, vpc, lambdaDbSg, props, stack);
    const updateETASchedulingRule = createETAUpdateSchedulingCloudWatchRule(stack);
    updateETASchedulingRule.addTarget(new LambdaFunction(updateETATimestampsLambda));
}

function createProcessQueueLambda(
    queue: Queue,
    timestampsUpdatedTopic: Topic,
    vpc: IVpc,
    lambdaDbSg: ISecurityGroup,
    props: Props,
    stack: Stack) {
    const functionName = "PortActivity-ProcessTimestampQueue";
    const lambdaConf = dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: functionName,
        code: new AssetCode('dist/lambda/process-queue'),
        handler: 'lambda-process-queue.handler',
        environment: {
            DB_USER: props.dbProps.username,
            DB_PASS: props.dbProps.password,
            DB_URI: props.dbProps.uri,
            ESTIMATE_SNS_TOPIC_ARN: timestampsUpdatedTopic.topicArn
        },
        reservedConcurrentExecutions: props.sqsProcessLambdaConcurrentExecutions
    });
    const processQueueLambda = new Function(stack, functionName, lambdaConf);
    processQueueLambda.addEventSource(new SqsEventSource(queue));
    timestampsUpdatedTopic.grantPublish(processQueueLambda);
    createSubscription(processQueueLambda, functionName, props.logsDestinationArn, stack);
}

function createProcessDLQLambda(
    dlqBucket: Bucket,
    dlq: Queue,
    props: Props,
    stack: Stack) {
    const lambdaEnv: any = {};
    lambdaEnv[BUCKET_NAME] = dlqBucket.bucketName;
    const functionName = "PortActivity-ProcessTimestampsDLQ";
    const processDLQLambda = new Function(stack, functionName, {
        runtime: Runtime.NODEJS_12_X,
        logRetention: RetentionDays.ONE_YEAR,
        functionName: functionName,
        code: new AssetCode('dist/lambda/process-dlq'),
        handler: 'lambda-process-dlq.handler',
        environment: lambdaEnv,
        reservedConcurrentExecutions: props.sqsProcessLambdaConcurrentExecutions
    });

    processDLQLambda.addEventSource(new SqsEventSource(dlq));

    createSubscription(processDLQLambda, functionName, props.logsDestinationArn, stack);

    const statement = new PolicyStatement();
    statement.addActions('s3:PutObject');
    statement.addActions('s3:PutObjectAcl');
    statement.addResources(dlqBucket.bucketArn + '/*');
    processDLQLambda.addToRolePolicy(statement);
}

function createETAUpdateSchedulingCloudWatchRule(stack: Stack): Rule {
    const ruleName = 'PortActivity-ETAScheduler'
    return new Rule(stack, ruleName, {
        ruleName,
        schedule: Schedule.expression('cron(*/15 * * * ? *)') // every 15 minutes
    });
}

function createUpdateETATimestampsLambda(
    timestampsUpdatedTopic: Topic,
    vpc: IVpc,
    lambdaDbSg: ISecurityGroup,
    props: Props,
    stack: Stack): Function {

    const environment: any = {
        DB_USER: props.dbProps.username,
        DB_PASS: props.dbProps.password,
        DB_URI: props.dbProps.uri
    };
    environment[KEY_ENDPOINT_CLIENT_ID] = props.etaProps.clientId;
    environment[KEY_ENDPOINT_CLIENT_SECRET] = props.etaProps.clientSecret;
    environment[KEY_ENDPOINT_AUDIENCE] = props.etaProps.audience;
    environment[KEY_ENDPOINT_AUTH_URL] = props.etaProps.authUrl;
    environment[KEY_ENDPOINT_URL] = props.etaProps.endpointUrl;
    environment[KEY_ESTIMATE_SOURCE] = props.etaProps.timestampSource;
    environment[KEY_ESTIMATE_SNS_TOPIC_ARN] = timestampsUpdatedTopic.topicArn;

    const functionName = 'PortActivity-UpdateETATimestamps';
    const lambdaConf = dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: functionName,
        code: new AssetCode('dist/lambda/update-eta-timestamps'),
        handler: 'lambda-update-eta-timestamps.handler',
        environment,
        reservedConcurrentExecutions: props.sqsProcessLambdaConcurrentExecutions
    });
    const lambda = new Function(stack, functionName, lambdaConf);
    timestampsUpdatedTopic.grantPublish(lambda);
    createSubscription(lambda, functionName, props.logsDestinationArn, stack);
    return lambda;
}