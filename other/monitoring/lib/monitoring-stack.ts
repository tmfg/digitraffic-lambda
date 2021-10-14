import {Construct, Stack, StackProps} from '@aws-cdk/core';
import {Topic} from '@aws-cdk/aws-sns';
import {EmailSubscription} from '@aws-cdk/aws-sns-subscriptions';
import {MonitoringConfiguration} from "./app-props";
import {DigitrafficSecurityRule} from "digitraffic-common/security/security-rule";
import {StringParameter} from "@aws-cdk/aws-ssm";
import {SSM_KEY_ALARM_TOPIC, SSM_KEY_WARNING_TOPIC} from "digitraffic-common/stack/stack";

export class MonitoringStack extends Stack {
    constructor(scope: Construct, id: string, configuration: MonitoringConfiguration, props?: StackProps) {
        super(scope, id, props);

        const alarmsTopic = this.createTopic('digitraffic-monitoring-alarms', configuration.alarmTopicEmail);
        const warningsTopic = this.createTopic('digitraffic-monitoring-warnings', configuration.warningTopicEmail);

        new StringParameter(this, 'AlarmsParam', {
            description: 'Alarms topic ARN',
            parameterName: SSM_KEY_ALARM_TOPIC,
            stringValue: alarmsTopic.topicArn
        });

        new StringParameter(this, 'WarningsParam', {
            description: 'Warnings topic ARN',
            parameterName: SSM_KEY_WARNING_TOPIC,
            stringValue: warningsTopic.topicArn
        });

        //new DigitrafficSecurityRule(this, alarmsTopic);
    }

    createTopic(topicName: string, email: string): Topic {
        const topic = new Topic(this, topicName, {
            topicName
        });

        topic.addSubscription(new EmailSubscription(email));

        return topic;
    }
}
