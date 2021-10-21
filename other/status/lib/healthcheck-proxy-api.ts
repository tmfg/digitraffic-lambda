import {Props} from "./app-props";
import {createIpRestrictionPolicyDocument} from "digitraffic-common/api/rest_apis";
import {EndpointType, LambdaIntegration, MethodLoggingLevel, Resource, RestApi} from "@aws-cdk/aws-apigateway";
import {createSubscription} from "digitraffic-common/stack/subscription";
import {AssetCode, Function, Runtime} from "@aws-cdk/aws-lambda";
import {Construct, Duration, Stack} from "@aws-cdk/core";
import {KEY_APP} from "./lambda/mqtt-proxy-healthcheck/lambda-mqtt-proxy-healthcheck";
import {RetentionDays} from "@aws-cdk/aws-logs";
import {MonitoredFunction} from "digitraffic-common/lambda/monitoredfunction";
import {TrafficType} from "digitraffic-common/model/traffictype";
import {ITopic} from "@aws-cdk/aws-sns";

export function create(stack: Stack, alarmSnsTopic: ITopic, warningSnsTopic: ITopic, props: Props) {
    const api = createApi(stack, props.allowFromIpAddresses)

    const resource = api.root.addResource("healthcheck-proxy");

    createMqttProxyResource(api, resource, 'Meri', props, alarmSnsTopic, warningSnsTopic, stack);
    createMqttProxyResource(api, resource, 'Tie', props, alarmSnsTopic, warningSnsTopic, stack);
}

function createApi(stack: Construct, allowFromIpAddresses: string[]) {
    return new RestApi(stack, 'HC-Proxy', {
        endpointExportName: 'HC-Proxy',
        deployOptions: {
            loggingLevel: MethodLoggingLevel.ERROR,
        },
        restApiName: 'Healthcheck Proxy API',
        endpointTypes: [EndpointType.REGIONAL],
        policy: createIpRestrictionPolicyDocument(allowFromIpAddresses)
    });
}

function createMqttProxyResource(
    publicApi: RestApi,
    resource: Resource,
    app: string,
    props: Props,
    alarmSnsTopic: ITopic,
    warningSnsTopic: ITopic,
    stack: Stack): Function {

    const functionName = `Status-MqttProxy${app}`;

    const assetCode = new AssetCode('dist/lambda/mqtt-proxy-healthcheck');

    const env: any = {};
    env[KEY_APP] = app.toLowerCase();

    const lambda = new MonitoredFunction(stack, functionName,{
        functionName,
        code: assetCode,
        handler: 'lambda-mqtt-proxy-healthcheck.handler',
        runtime: Runtime.NODEJS_12_X,
        reservedConcurrentExecutions: 1,
        timeout: Duration.seconds(10),
        memorySize: 128,
        environment: env,
        logRetention: RetentionDays.ONE_YEAR
    }, alarmSnsTopic, warningSnsTopic, true, TrafficType.OTHER);

    const integration = new LambdaIntegration(lambda, {
        proxy: true
    });

    const mqttProxyResource = resource.addResource(`${app.toLowerCase()}-mqtt`);
    mqttProxyResource.addMethod("GET", integration);

    createSubscription(lambda, functionName, props.logsDestinationArn, stack);

    return lambda;
}
