import { Stack, type StackProps } from "aws-cdk-lib";
import { LogGroup, FilterPattern } from "aws-cdk-lib/aws-logs";
import { Stream } from "aws-cdk-lib/aws-kinesis";
import { KinesisDestination } from "aws-cdk-lib/aws-logs-destinations";
import type { Construct } from "constructs";
import type { AppLogSubscription } from "./app-props.js";

export class AppLogsSubscriptionStack extends Stack {
    constructor(scope: Construct, id: string, appProps: AppLogSubscription, props?: StackProps) {
        super(scope, id, props);

        const kinesisStream = Stream.fromStreamArn(this, "kinesis-stream", appProps.destinationArn);
        const kinesisDestination = new KinesisDestination(kinesisStream);

        appProps.logGroupNames.forEach((name) => this.createSubscriptions(scope, kinesisDestination, name));
    }

    createSubscriptions(scope: Construct, kinesisDestination: KinesisDestination, logGroupName: string) {
        const logGroup = LogGroup.fromLogGroupName(this, logGroupName, logGroupName);

        // eslint-disable-next-line eqeqeq
        if (logGroup != null) {
            logGroup.addSubscriptionFilter(`kinesis-subscription`, {
                destination: kinesisDestination,
                filterPattern: FilterPattern.allEvents()
            });
        }
    }
}
