import {Bucket} from "aws-cdk-lib/aws-s3";
import {MarinecamEnvKeys} from "./keys";
import {DigitrafficStack} from "digitraffic-common/stack/stack";
import {MonitoredDBFunction, MonitoredFunction} from "digitraffic-common/lambda/monitoredfunction";
import {MobileServerProps} from "./app-props";
import {Scheduler} from "digitraffic-common/scheduler/scheduler";

export function create(stack: DigitrafficStack,
    bucket: Bucket) {

    const updateLambda = createUpdateImagesLambda(stack, bucket);

    bucket.grantWrite(updateLambda);
}

function createUpdateImagesLambda(stack: DigitrafficStack,
    bucket: Bucket) {
    const environment = stack.createLambdaEnvironment();
    environment[MarinecamEnvKeys.BUCKET_NAME] = bucket.bucketName;

    const lambda = MonitoredDBFunction.create(stack, 'update-images', environment, {
        reservedConcurrentExecutions: 2,
    });

    Scheduler.every(stack, 'UpdateImages-Rule', (stack.configuration as MobileServerProps).updateFrequency, lambda);

    return lambda;
}
