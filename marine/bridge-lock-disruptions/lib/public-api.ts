import {IModel, Resource, RestApi} from 'aws-cdk-lib/aws-apigateway';
import {Function} from 'aws-cdk-lib/aws-lambda';
import {default as DisruptionSchema} from './model/disruption-schema';
import {DigitrafficLogSubscriptions} from 'digitraffic-common/aws/infra/stack/subscription';
import {corsMethod, defaultIntegration, methodResponse} from "digitraffic-common/aws/infra/api/responses";
import {addServiceModel, featureSchema, geojsonSchema, getModelReference} from "digitraffic-common/utils/api-model";
import {databaseFunctionProps} from "digitraffic-common/aws/infra/stack/lambda-configs";
import {addTags, DocumentationPart} from "digitraffic-common/aws/infra/documentation";
import {MediaType} from "digitraffic-common/aws/types/mediatypes";
import {DigitrafficStack} from "digitraffic-common/aws/infra/stack/stack";
import {MonitoredFunction} from "digitraffic-common/aws/infra/stack/monitoredfunction";
import {DigitrafficIntegrationResponse} from "digitraffic-common/aws/runtime/digitraffic-integration-response";
import {DigitrafficRestApi} from "digitraffic-common/aws/infra/stack/rest_apis";
import {createUsagePlan} from "digitraffic-common/aws/infra/usage-plans";

const BRIDGE_LOCK_DISRUPTION_TAGS_V1 = ['Bridge Lock Disruption V1'];

export class PublicApi {
    oldDisruptionsResource: Resource;
    disruptionsResource: Resource;

    constructor(stack: DigitrafficStack) {
        const publicApi = this.createApi(stack);

        createUsagePlan(publicApi, 'BridgeLock Api Key', 'BridgeLock Usage Plan');
        //        publicApi.createUsagePlanV2('BridgeLock');

        const disruptionModel = addServiceModel("DisruptionModel", publicApi, DisruptionSchema);
        const featureModel = addServiceModel("FeatureModel", publicApi, featureSchema(getModelReference(disruptionModel.modelId, publicApi.restApiId)));
        const disruptionsModel = addServiceModel("DisruptionsModel", publicApi, geojsonSchema(getModelReference(featureModel.modelId, publicApi.restApiId)));

        this.createResourcePaths(publicApi);
        this.createDisruptionsResource(publicApi, disruptionsModel, stack);

        publicApi.documentResource(this.oldDisruptionsResource, DocumentationPart.method(['bridge-lock-disruptions'], 'getDisruptions', '').deprecated('Deprecated.  This will be removed in the future.'));
        publicApi.documentResource(this.disruptionsResource, DocumentationPart.method(BRIDGE_LOCK_DISRUPTION_TAGS_V1, 'getDisruptions', 'Return all waterway traffic disruptions'));
    }

    createDisruptionsResource(publicApi: RestApi,
        disruptionsJsonModel: IModel,
        stack: DigitrafficStack): Function {

        const functionName = 'BridgeLockDisruption-GetDisruptions';
        const environment = stack.createDefaultLambdaEnvironment('BridgeLockDisruption');

        const getDisruptionsLambda = MonitoredFunction.create(stack, functionName, databaseFunctionProps(
            stack, environment, functionName, 'get-disruptions', {
                timeout: 60,
                reservedConcurrentExecutions: 3,
            },
        ));

        stack.secret.grantRead(getDisruptionsLambda);

        const getDisruptionsIntegration = defaultIntegration(getDisruptionsLambda, {
            responses: [
                DigitrafficIntegrationResponse.ok(MediaType.APPLICATION_JSON),
            ],
        });

        ['GET', 'HEAD'].forEach(httpMethod => {
            [this.oldDisruptionsResource, this.disruptionsResource].forEach(resource => {
                resource.addMethod(httpMethod, getDisruptionsIntegration, {
                    apiKeyRequired: true,
                    methodResponses: [
                        corsMethod(methodResponse("200", MediaType.APPLICATION_JSON, disruptionsJsonModel)),
                    ],
                });
            });
        });

        new DigitrafficLogSubscriptions(stack, getDisruptionsLambda);

        return getDisruptionsLambda;
    }

    createResourcePaths(publicApi: RestApi) {
        const apiResource = publicApi.root.addResource("api");

        // old resourcePaths
        const oldV2Resource = apiResource.addResource("v2");
        const oldBridgeLockResource = oldV2Resource.addResource("bridge-lock");
        this.oldDisruptionsResource = oldBridgeLockResource.addResource("disruptions");

        // new paths
        const bridgeLockResource = apiResource.addResource("bridge-lock");
        const v1Resource = bridgeLockResource.addResource("v1");
        this.disruptionsResource = v1Resource.addResource("disruptions");
    }

    createApi(stack: DigitrafficStack): DigitrafficRestApi {
        return new DigitrafficRestApi(stack, 'BridgeLockDisruption-public', 'BridgeLockDisruption public API');
    }
}