import {EndpointType, LambdaIntegration, MethodLoggingLevel, Resource, RestApi} from 'aws-cdk-lib/aws-apigateway';
import {AssetCode} from 'aws-cdk-lib/aws-lambda';
import {Stack} from "aws-cdk-lib";
import {createSubscription} from "@digitraffic/common/dist/aws/infra/stack/subscription";
import {defaultLambdaConfiguration} from '@digitraffic/common/dist/aws/infra/stack/lambda-configs';
import {VoyagePlanGatewayProps} from "./app-props";
import {ISecret} from "aws-cdk-lib/aws-secretsmanager";
import {add404Support, createDefaultPolicyDocument} from "@digitraffic/common/dist/aws/infra/stack/rest_apis";
import {VoyagePlanEnvKeys} from "./keys";
import {createUsagePlan} from "@digitraffic/common/dist/aws/infra/usage-plans";
import {MonitoredFunction} from "@digitraffic/common/dist/aws/infra/stack/monitoredfunction";
import {DigitrafficStack} from "@digitraffic/common/dist/aws/infra/stack/stack";

export function create(secret: ISecret,
    props: VoyagePlanGatewayProps,
    stack: DigitrafficStack) {

    const api = createRestApi(stack,
        'VPGW-Public',
        'VPGW public API');

    const resource = api.root.addResource('temp').addResource('schedules');
    createUsagePlan(api, 'VPGW Public CloudFront API Key', 'VPGW Public CloudFront Usage Plan');
    createVtsProxyHandler(stack,
        resource,
        secret,
        props);
}

function createRestApi(stack: Stack, apiId: string, apiName: string): RestApi {
    const restApi = new RestApi(stack, apiId, {
        deployOptions: {
            loggingLevel: MethodLoggingLevel.ERROR,
        },
        restApiName: apiName,
        endpointTypes: [EndpointType.REGIONAL],
        policy: createDefaultPolicyDocument(),
    });
    add404Support(restApi, stack);
    return restApi;
}

function createVtsProxyHandler(stack: DigitrafficStack,
    api: Resource,
    secret: ISecret,
    props: VoyagePlanGatewayProps) {

    const env: Record<string, string> = {};
    env[VoyagePlanEnvKeys.SECRET_ID] = props.secretId;
    const functionName = 'VPGW-Get-Schedules';
    // ATTENTION!
    // This lambda needs to run in a VPC so that the outbound IP address is always the same (NAT Gateway).
    // The reason for this is IP based restriction in another system's firewall.
    const handler = MonitoredFunction.create(stack, functionName, defaultLambdaConfiguration({
        functionName,
        code: new AssetCode('dist/lambda/get-schedules'),
        handler: 'lambda-get-schedules.handler',
        environment: env,
        vpc: stack.vpc,
        timeout: 10,
        reservedConcurrentExecutions: 1,
        memorySize: 128,
    }));
    secret.grantRead(handler);
    createSubscription(handler, functionName, props.logsDestinationArn, stack);
    const integration = new LambdaIntegration(handler, {
        proxy: true,
    });
    api.addMethod('GET', integration, {
        apiKeyRequired: true,
    });
}
