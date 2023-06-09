import { Scheduler } from "@digitraffic/common/dist/aws/infra/scheduler";
import {
    MonitoredDBFunction,
    MonitoredFunction
} from "@digitraffic/common/dist/aws/infra/stack/monitoredfunction";
import { DigitrafficStack } from "@digitraffic/common/dist/aws/infra/stack/stack";
import { createSubscription } from "@digitraffic/common/dist/aws/infra/stack/subscription";
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { MaintenanceTrackingEnvKeys } from "./keys";
import { MaintenanceTrackingStackConfiguration } from "./maintenance-tracking-stack-configuration";
import { QueueAndDLQ } from "./sqs";

export function createCleanMaintenanceTrackingDataLambda(stack: DigitrafficStack): MonitoredFunction {
    const environment = stack.createLambdaEnvironment();

    const lambdaFunction = MonitoredDBFunction.create(stack, "clean-maintenance-tracking-data", environment, {
        memorySize: 128,
        timeout: 600
    });

    Scheduler.everyHour(stack, `MaintenanceTracking-cleanMaintenanceTrackingDataEveryHour`, lambdaFunction);

    return lambdaFunction;
}

export function createProcessQueueAndDlqLambda(
    queueAndDLQ: QueueAndDLQ,
    dlqBucket: Bucket,
    sqsExtendedMessageBucketArn: string,
    stackConfiguration: MaintenanceTrackingStackConfiguration,
    stack: DigitrafficStack
): void {
    createProcessQueueLambda(
        queueAndDLQ.queue,
        dlqBucket.urlForObject(),
        sqsExtendedMessageBucketArn,
        stackConfiguration,
        stack
    );
    createProcessDLQLambda(dlqBucket, queueAndDLQ.dlq, stackConfiguration, stack);
}

function createProcessQueueLambda(
    queue: Queue,
    dlqBucketUrl: string,
    sqsExtendedMessageBucketArn: string,
    stackConfiguration: MaintenanceTrackingStackConfiguration,
    stack: DigitrafficStack
): void {
    const role = createLambdaRoleWithReadS3Policy(stack, sqsExtendedMessageBucketArn);

    const secret = stack.secret;

    const lambdaEnv = stack.createLambdaEnvironment();
    lambdaEnv[MaintenanceTrackingEnvKeys.SQS_BUCKET_NAME] = stackConfiguration.sqsMessageBucketName;
    lambdaEnv[MaintenanceTrackingEnvKeys.SQS_QUEUE_URL] = queue.queueUrl;

    const processQueueLambda = MonitoredFunction.createV2(stack, "process-queue", lambdaEnv, {
        reservedConcurrentExecutions: 100,
        timeout: 60,
        role: role,
        memorySize: 256
    });

    // Handle only one message per time
    processQueueLambda.addEventSource(
        new SqsEventSource(queue, {
            batchSize: 1
        })
    );
    secret?.grantRead(processQueueLambda);
    createSubscription(
        processQueueLambda,
        processQueueLambda.givenName,
        stackConfiguration.logsDestinationArn,
        stack
    );
}

function createProcessDLQLambda(
    dlqBucket: Bucket,
    dlq: Queue,
    stackConfiguration: MaintenanceTrackingStackConfiguration,
    stack: DigitrafficStack
): void {
    const lambdaEnv = stack.createLambdaEnvironment();
    lambdaEnv[MaintenanceTrackingEnvKeys.SQS_DLQ_BUCKET_NAME] = dlqBucket.bucketName;

    const processDLQLambda = MonitoredFunction.createV2(stack, "process-dlq", lambdaEnv, {
        reservedConcurrentExecutions: 1,
        timeout: 10,
        memorySize: 256
    });

    processDLQLambda.addEventSource(new SqsEventSource(dlq));

    createSubscription(
        processDLQLambda,
        processDLQLambda.givenName,
        stackConfiguration.logsDestinationArn,
        stack
    );

    const statement = new PolicyStatement();
    statement.addActions("s3:PutObject");
    statement.addActions("s3:PutObjectAcl");
    statement.addResources(dlqBucket.bucketArn + "/*");
    processDLQLambda.addToRolePolicy(statement);
}

function createLambdaRoleWithReadS3Policy(stack: Construct, sqsExtendedMessageBucketArn: string): Role {
    const lambdaRole = new Role(stack, `ReadSqsExtendedMessageBucketRole`, {
        assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        roleName: `ReadSqsExtendedMessageBucketRole`
    });

    const s3PolicyStatement = new PolicyStatement();
    s3PolicyStatement.addActions("s3:GetObject"); // Read big messages from S3
    s3PolicyStatement.addActions("s3:DeleteObject"); // Delete handled big messages from S3
    s3PolicyStatement.addResources(sqsExtendedMessageBucketArn + "/*");

    lambdaRole.addToPolicy(s3PolicyStatement);
    lambdaRole.addManagedPolicy(
        ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
    );
    lambdaRole.addManagedPolicy(
        ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole")
    );
    return lambdaRole;
}
