import { IModel, Resource, RestApi } from "aws-cdk-lib/aws-apigateway";
import { default as DisruptionSchema } from "./model/disruption-schema";
import {
    addServiceModel,
    featureSchema,
    geojsonSchema,
    getModelReference,
} from "@digitraffic/common/dist/utils/api-model";
import { DocumentationPart } from "@digitraffic/common/dist/aws/infra/documentation";
import { MediaType } from "@digitraffic/common/dist/aws/types/mediatypes";
import { DigitrafficStack } from "@digitraffic/common/dist/aws/infra/stack/stack";
import {
    MonitoredDBFunction,
    MonitoredFunction,
} from "@digitraffic/common/dist/aws/infra/stack/monitoredfunction";
import { DigitrafficIntegration } from "@digitraffic/common/dist/aws/infra/api/integration";
import { DigitrafficMethodResponse } from "@digitraffic/common/dist/aws/infra/api/response";
import { DigitrafficRestApi } from "@digitraffic/common/dist/aws/infra/stack/rest_apis";
import { createUsagePlan } from "@digitraffic/common/dist/aws/infra/usage-plans";

const BRIDGE_LOCK_DISRUPTION_TAGS_V1 = ["Bridge Lock Disruption V1"];

export class PublicApi {
    oldDisruptionsResource: Resource;
    disruptionsResource: Resource;

    constructor(stack: DigitrafficStack) {
        const publicApi = this.createApi(stack);

        createUsagePlan(
            publicApi,
            "BridgeLock Api Key",
            "BridgeLock Usage Plan"
        );

        const disruptionModel = addServiceModel(
            "DisruptionModel",
            publicApi,
            DisruptionSchema
        );
        const featureModel = addServiceModel(
            "FeatureModel",
            publicApi,
            featureSchema(
                getModelReference(disruptionModel.modelId, publicApi.restApiId)
            )
        );
        const disruptionsModel = addServiceModel(
            "DisruptionsModel",
            publicApi,
            geojsonSchema(
                getModelReference(featureModel.modelId, publicApi.restApiId)
            )
        );

        this.createResourcePaths(publicApi);
        const disruptionsLambda = this.createDisruptionsResource(
            publicApi,
            disruptionsModel,
            stack
        );

        const sunsetDate = "2023-06-01";
        this.createOldDisruptionsResource(
            publicApi,
            disruptionsModel,
            stack,
            disruptionsLambda,
            sunsetDate
        );

        publicApi.documentResource(
            this.oldDisruptionsResource,
            DocumentationPart.method(
                ["bridge-lock-disruptions"],
                "getDisruptions",
                "Return all waterway traffic disruptions"
            ).deprecated(`Will be removed after ${sunsetDate}`)
        );
        publicApi.documentResource(
            this.disruptionsResource,
            DocumentationPart.method(
                BRIDGE_LOCK_DISRUPTION_TAGS_V1,
                "getDisruptions",
                "Return all waterway traffic disruptions"
            )
        );
    }

    createDisruptionsResource(
        publicApi: RestApi,
        disruptionsJsonModel: IModel,
        stack: DigitrafficStack
    ): MonitoredFunction {
        const getDisruptionsLambda = MonitoredDBFunction.create(
            stack,
            "get-disruptions"
        );
        const getDisruptionsIntegration = new DigitrafficIntegration(
            getDisruptionsLambda,
            MediaType.APPLICATION_JSON
        ).build();

        ["GET", "HEAD"].forEach((httpMethod) => {
            [this.disruptionsResource].forEach((resource) => {
                resource.addMethod(httpMethod, getDisruptionsIntegration, {
                    apiKeyRequired: true,
                    methodResponses: [
                        DigitrafficMethodResponse.response200(
                            disruptionsJsonModel,
                            MediaType.APPLICATION_JSON
                        ),
                    ],
                });
            });
        });

        return getDisruptionsLambda;
    }

    createOldDisruptionsResource(
        publicApi: RestApi,
        disruptionsJsonModel: IModel,
        stack: DigitrafficStack,
        lambda: MonitoredFunction,
        sunset: string
    ) {
        const getDeprecatedDisruptionsIntegration = new DigitrafficIntegration(
            lambda,
            MediaType.APPLICATION_JSON,
            sunset
        ).build();

        ["GET", "HEAD"].forEach((httpMethod) => {
            [this.oldDisruptionsResource].forEach((resource) => {
                resource.addMethod(
                    httpMethod,
                    getDeprecatedDisruptionsIntegration,
                    {
                        apiKeyRequired: true,
                        methodResponses: [
                            DigitrafficMethodResponse.response(
                                "200",
                                disruptionsJsonModel,
                                MediaType.APPLICATION_JSON,
                                false,
                                true
                            ),
                        ],
                    }
                );
            });
        });
    }

    createResourcePaths(publicApi: RestApi) {
        const apiResource = publicApi.root.addResource("api");

        // old resourcePaths
        const oldV2Resource = apiResource.addResource("v2");
        const oldBridgeLockResource = oldV2Resource.addResource("bridge-lock");
        this.oldDisruptionsResource =
            oldBridgeLockResource.addResource("disruptions");

        // new paths
        const bridgeLockResource = apiResource.addResource("bridge-lock");
        const v1Resource = bridgeLockResource.addResource("v1");
        this.disruptionsResource = v1Resource.addResource("disruptions");
    }

    createApi(stack: DigitrafficStack): DigitrafficRestApi {
        return new DigitrafficRestApi(
            stack,
            "BridgeLockDisruption-public",
            "BridgeLockDisruption public API"
        );
    }
}
