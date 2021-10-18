import {databaseFunctionProps, lambdaFunctionProps} from "digitraffic-common/stack/lambda-configs";
import {createUsagePlan} from "digitraffic-common/stack/usage-plans";
import {addSimpleServiceModel} from "digitraffic-common/api/utils";
import {RestApi} from '@aws-cdk/aws-apigateway';
import {Function} from '@aws-cdk/aws-lambda';
import {corsMethod, defaultIntegration, methodResponse,} from "digitraffic-common/api/responses";
import {DigitrafficLogSubscriptions} from "digitraffic-common/stack/subscription";
import {addQueryParameterDescription, addTagsAndSummary} from "digitraffic-common/api/documentation";
import {DATA_V1_TAGS} from "digitraffic-common/api/tags";
import {MessageModel} from "digitraffic-common/api/response";
import {DigitrafficRestApi} from "digitraffic-common/api/rest_apis";
import {MediaType} from "digitraffic-common/api/mediatypes";
import {DigitrafficStack} from "digitraffic-common/stack/stack";
import {MonitoredFunction} from "digitraffic-common/lambda/monitoredfunction";
import {ISecret} from "@aws-cdk/aws-secretsmanager";
import {DigitrafficIntegrationResponse} from "digitraffic-common/api/digitraffic-integration-response";

export function create(stack: DigitrafficStack, secret: ISecret) {
    const publicApi = new DigitrafficRestApi(stack, 'VariableSigns-public', 'Variable Signs public API');

    createUsagePlan(publicApi, 'VariableSigns Api Key', 'VariableSigns Usage Plan');

    return createDatex2Resource(stack, publicApi, secret);
}

function createDatex2Resource(stack: DigitrafficStack, publicApi: RestApi, secret: ISecret): Function {
    const environment = stack.createDefaultLambdaEnvironment('VS');
    const functionName = 'VS-GetDatex2';

    const getDatex2Lambda = MonitoredFunction.create(stack, functionName, databaseFunctionProps(stack, environment, functionName, 'get-datex2', {
        memorySize: 256,
    }));

    const imageFunctionName = 'VS-GetImage';
    const getImageLambda = MonitoredFunction.create(stack, imageFunctionName, lambdaFunctionProps(stack, {}, imageFunctionName, 'get-sign-image'));

    secret.grantRead(getDatex2Lambda);
    new DigitrafficLogSubscriptions(stack, getDatex2Lambda, getImageLambda);

    const getDatex2Integration = defaultIntegration(getDatex2Lambda, {xml: true});
    const errorResponseModel = publicApi.addModel('MessageResponseModel', MessageModel);
    const xmlModel = addSimpleServiceModel('XmlModel', publicApi);
    const svgModel = addSimpleServiceModel('SvgModel', publicApi, 'image/svg+xml')

    const apiResource = publicApi.root.addResource("api");
    const v1Resource = apiResource.addResource("v1");
    const vsResource = v1Resource.addResource("variable-signs");
    const datex2Resource = vsResource.addResource("datex2");
    const imagesResource = vsResource.addResource("images");
    const imageResource = imagesResource.addResource("{text}");

    datex2Resource.addMethod("GET", getDatex2Integration, {
        apiKeyRequired: true,
        methodResponses: [
            corsMethod(methodResponse("200", MediaType.APPLICATION_XML, xmlModel)),
            corsMethod(methodResponse("500", MediaType.APPLICATION_XML, errorResponseModel))
        ]
    });

    addTagsAndSummary('GetDatex2', DATA_V1_TAGS, 'Return all variables signs as datex2', datex2Resource, stack);

    const getImageIntegration = defaultIntegration(getImageLambda, {
        xml: true,
        requestParameters: {
            'integration.request.path.text': 'method.request.path.text'
        },
        requestTemplates: {
            'application/json': JSON.stringify({text: "$util.escapeJavaScript($input.params('text'))"})
        },
        responses: [DigitrafficIntegrationResponse.ok(MediaType.IMAGE_SVG)]
    });
    imageResource.addMethod("GET", getImageIntegration, {
        apiKeyRequired: true,
        requestParameters: {
            'method.request.path.text': true
        },
        methodResponses: [
            corsMethod(methodResponse("200", MediaType.IMAGE_SVG, svgModel)),
            corsMethod(methodResponse("400", MediaType.TEXT_PLAIN, errorResponseModel))

        ]
    });

    addTagsAndSummary('GetImage', DATA_V1_TAGS, 'Generate svg-image from given text', imageResource, stack);
    addQueryParameterDescription('text', 'formatted [text] from variable sign textrows, without the brackets', imageResource, stack);

    return getDatex2Lambda;
}
