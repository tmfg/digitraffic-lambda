import {uploadToS3} from "digitraffic-common/aws/runtime/s3";
import {MaintenanceTrackingEnvKeys} from "../../keys";
import {SQSEvent} from "aws-lambda";
import {SQSRecord} from "aws-lambda/trigger/sqs";

const bucketName = process.env[MaintenanceTrackingEnvKeys.SQS_DLQ_BUCKET_NAME] as string;

export const handler = (event: SQSEvent) => {
    const iso = new Date().toISOString();

    console.error(`method=handleMaintenanceTrackingDlq receivedCount=${event.Records.length}`);
    const uploads = event.Records.map((e: SQSRecord, idx: number) => {
        console.error(`method=handleMaintenanceTrackingDlq content: ${e.body}`);
        uploadToS3(bucketName, e.body, `${iso}-maintenanceTracking-${idx}.txt`);
    });
    return Promise.all(uploads);
};
