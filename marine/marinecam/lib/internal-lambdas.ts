import {Bucket} from "aws-cdk-lib/aws-s3";
import {MarinecamEnvKeys} from "./keys";
import {DigitrafficStack} from "digitraffic-common/aws/infra/stack/stack";
import {MonitoredDBFunction} from "digitraffic-common/aws/infra/stack/monitoredfunction";
import {MobileServerProps} from "./app-props";
import {Scheduler} from "digitraffic-common/aws/infra/scheduler";

export function create(stack: DigitrafficStack,
    bucket: Bucket) {

    const updateLambda = createUpdateImagesLambda(stack, bucket);

    Scheduler.every(stack, 'UpdateImages-Rule', (stack.configuration as MobileServerProps).updateFrequency, updateLambda);
    bucket.grantWrite(updateLambda);
}

function createUpdateImagesLambda(stack: DigitrafficStack,
    bucket: Bucket) {
    const environment = stack.createLambdaEnvironment();
    environment[MarinecamEnvKeys.BUCKET_NAME] = bucket.bucketName;

    return MonitoredDBFunction.create(stack, 'update-images', environment);
}
