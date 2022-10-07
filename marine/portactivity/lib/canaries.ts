import {Queue} from "aws-cdk-lib/aws-sqs";
import {SnsAction} from "aws-cdk-lib/aws-cloudwatch-actions";
import {Topic} from "aws-cdk-lib/aws-sns";
import {ComparisonOperator, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Schedule} from "@aws-cdk/aws-synthetics-alpha";
import {UrlCanary} from "@digitraffic/common/aws/infra/canaries/url-canary";
import {DatabaseCanary} from "@digitraffic/common/aws/infra/canaries/database-canary";
import {DigitrafficStack} from "@digitraffic/common/aws/infra/stack/stack";
import {PortactivityConfiguration} from "./app-props";
import {DigitrafficCanaryRole} from "@digitraffic/common/aws/infra/canaries/canary-role";
import {PublicApi} from "./public-api";

export class Canaries {
    constructor(stack: DigitrafficStack,
        dlq: Queue,
        publicApi: PublicApi) {
        addDLQAlarm(stack, dlq, stack.configuration as PortactivityConfiguration);

        if (stack.configuration.stackFeatures?.enableCanaries ?? false) {
            const urlRole = new DigitrafficCanaryRole(stack, 'portactivity-url');
            const dbRole = new DigitrafficCanaryRole(stack, 'portactivity-db').withDatabaseAccess();

            new UrlCanary(stack, urlRole, {
                name: 'pa-public',
                hostname: publicApi.publicApi.hostname(),
                handler: 'public-api.handler',
                secret: stack.configuration.secretId,
                alarm: {
                    alarmName: 'PortActivity-PublicAPI-Alarm',
                    topicArn: stack.configuration.warningTopicArn,
                },
            }, stack.secret);

            new UrlCanary(stack, urlRole, {
                name: 'pa-private',
                hostname: publicApi.publicApi.hostname(),
                handler: "private-api.handler",
                apiKeyId: publicApi.apiKeyId,
                alarm: {
                    alarmName: 'PortActivity-PrivateAPI-Alarm',
                    topicArn: stack.configuration.warningTopicArn,
                },
            });

            new DatabaseCanary(stack, dbRole, stack.secret, {
                name: 'pa-daytime',
                secret: stack.configuration.secretId,
                schedule: Schedule.expression("cron(0/15 2-19 ? * MON-SUN *)"),
                handler: 'daytime-db.handler',
                alarm: {
                    alarmName: 'PortActivity-Db-Day-Alarm',
                    topicArn: stack.configuration.warningTopicArn,
                },
            });

            new DatabaseCanary(stack, urlRole, stack.secret, {
                name: 'pa',
                secret: stack.configuration.secretId,
                handler: 'db.handler',
                alarm: {
                    alarmName: 'PortActivity-Db-Alarm',
                    topicArn: stack.configuration.warningTopicArn,
                },
            });
        }
    }
}

function addDLQAlarm(stack: DigitrafficStack, queue: Queue, config: PortactivityConfiguration) {
    const alarmName = 'PortActivity-TimestampsDLQAlarm';
    queue.metricNumberOfMessagesReceived({
        period: config.dlqNotificationDuration,
    }).createAlarm(stack, alarmName, {
        alarmName,
        threshold: 0,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new SnsAction(Topic.fromTopicArn(stack, 'Topic', config.warningTopicArn)));
}
