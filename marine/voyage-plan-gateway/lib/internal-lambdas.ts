import {AssetCode, Function} from '@aws-cdk/aws-lambda';
import {ISecurityGroup, IVpc} from '@aws-cdk/aws-ec2';
import {Stack} from '@aws-cdk/core';
import {defaultLambdaConfiguration} from 'digitraffic-common/stack/lambda-configs';
import {createSubscription} from 'digitraffic-common/stack/subscription';
import {Topic} from "@aws-cdk/aws-sns";
import {LambdaSubscription} from "@aws-cdk/aws-sns-subscriptions";
import {ISecret} from "@aws-cdk/aws-secretsmanager";
import {VoyagePlanGatewayProps} from "./app-props";
import {VoyagePlanEnvKeys} from "./keys";

export function create(
    secret: ISecret,
    notifyTopic: Topic,
    vpc: IVpc,
    props: VoyagePlanGatewayProps,
    stack: Stack) {

    createProcessVisMessagesLambda(secret, notifyTopic, props, stack);
}

function createProcessVisMessagesLambda(
    secret: ISecret,
    notifyTopic: Topic,
    props: VoyagePlanGatewayProps,
    stack: Stack) {

    const functionName = "VPGW-ProcessVisMessages";
    const environment = {} as any;
    environment[VoyagePlanEnvKeys.SECRET_ID] = props.secretId;
    const lambdaConf = defaultLambdaConfiguration({
        functionName: functionName,
        memorySize: 128,
        code: new AssetCode('dist/lambda/process-vis-messages'),
        handler: 'lambda-process-vis-messages.handler',
        environment
    });
    const lambda = new Function(stack, functionName, lambdaConf);
    secret.grantRead(lambda);
    notifyTopic.addSubscription(new LambdaSubscription(lambda));
    createSubscription(lambda, functionName, props.logsDestinationArn, stack);
}
