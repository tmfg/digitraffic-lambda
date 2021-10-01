import {Function, FunctionProps} from '@aws-cdk/aws-lambda';
import {Stack} from "@aws-cdk/core";
import {ITopic} from "@aws-cdk/aws-sns";
import {SnsAction} from "@aws-cdk/aws-cloudwatch-actions";
import {ComparisonOperator} from "@aws-cdk/aws-cloudwatch";
import {DigitrafficStack} from "../stack/stack";

export enum MonitoredFunctionAlarm {
    DURATION,
    ERRORS,
    THROTTLES,
    DURATION_WARNING
}

export type MonitoredFunctionProps = {
    /**
     *  Use to create alarms only for certain metrics
     */
    readonly includeAlarms?: MonitoredFunctionAlarm[]
}

/**
 * Creates a Lambda function that monitors default CloudWatch Lambda metrics with CloudWatch Alarms.
 */
export class MonitoredFunction extends Function {

    constructor(
        stack: DigitrafficStack,
        id: string,
        functionProps: FunctionProps,
        props?: MonitoredFunctionProps) {

        super(stack, id, functionProps);

        const alarmSnsAction = new SnsAction(stack.alarmTopic);
        const warningSnsAction = new SnsAction(stack.warningTopic);

        if (!functionProps.timeout) {
            throw new Error('Timeout needs to be explicitly set');
        }
        if (!props || props.includeAlarms?.includes(MonitoredFunctionAlarm.DURATION)) {
            this.metricDuration().createAlarm(stack, `${this.node.id}-Duration`, {
                alarmName: `${stack.stackName} ${this.functionName} duration alarm`,
                alarmDescription: `${this.functionName} duration has exceeded ${functionProps.timeout!.toSeconds()} seconds`,
                threshold: functionProps.timeout!.toMilliseconds(),
                evaluationPeriods: 1,
                datapointsToAlarm: 1,
                statistic: 'max',
                comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
            }).addAlarmAction(alarmSnsAction);
        }
        if (!props || props.includeAlarms?.includes(MonitoredFunctionAlarm.DURATION_WARNING)) {
            this.metricDuration().createAlarm(stack, `${this.node.id}-Duration-Warning`, {
                alarmName: `${stack.stackName} ${this.functionName} duration warning`,
                alarmDescription: `${this.functionName} duration is 85 % of max ${functionProps.timeout!.toSeconds()} seconds`,
                threshold: functionProps.timeout!.toMilliseconds() * 0.85,
                evaluationPeriods: 1,
                datapointsToAlarm: 1,
                statistic: 'max',
                comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
            }).addAlarmAction(warningSnsAction);
        }

        if (!props || props.includeAlarms?.includes(MonitoredFunctionAlarm.ERRORS)) {
            this.metricErrors().createAlarm(stack, `${this.node.id}-Errors`, {
                alarmName: `${stack.stackName} ${this.functionName} errors alarm`,
                alarmDescription: `${this.functionName} invocations did not succeed`,
                threshold: 1,
                evaluationPeriods: 1,
                datapointsToAlarm: 1,
                statistic: 'sum',
                comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
            }).addAlarmAction(alarmSnsAction);
        }

        if (!props || props.includeAlarms?.includes(MonitoredFunctionAlarm.THROTTLES)) {
            this.metricThrottles().createAlarm(stack, `${this.node.id}-Throttles`, {
                alarmName: `${stack.stackName} ${this.functionName} throttles alarm`,
                alarmDescription: `${this.functionName} has throttled`,
                threshold: 0,
                evaluationPeriods: 1,
                datapointsToAlarm: 1,
                statistic: 'sum',
                comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD
            }).addAlarmAction(alarmSnsAction);
        }
    }

}
