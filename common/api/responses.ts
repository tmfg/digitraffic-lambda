import {NOT_FOUND_MESSAGE} from "./errors";
import {
    APPLICATION_JSON,
    InternalServerErrorResponseTemplate,
    createResponses,
    XmlResponseTemplate, APPLICATION_XML, NotFoundResponseTemplate
} from "./response";
import {LambdaIntegration, MethodResponse} from "@aws-cdk/aws-apigateway";
import {Function} from '@aws-cdk/aws-lambda';

const CORS_INTEGRATION_RESPONSE = {
    responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'"
    }
};

export const RESPONSE_200_OK = {
    statusCode: '200'
};

export const RESPONSE_200_OK_CORS = Object.assign({}, RESPONSE_200_OK, CORS_INTEGRATION_RESPONSE);

export const RESPONSE_200_OK_XML = {
    statusCode: '200',
    responseTemplates: XmlResponseTemplate
}

export const RESPONSE_404_NOT_FOUND = {
    statusCode: '404',
    selectionPattern: NOT_FOUND_MESSAGE,
    responseTemplates: NotFoundResponseTemplate
};

const RESPONSE_404_NOT_FOUND_CORS = Object.assign({}, RESPONSE_404_NOT_FOUND, CORS_INTEGRATION_RESPONSE);

export const RESPONSE_500_SERVER_ERROR = {
    statusCode: '500',
    selectionPattern: '(\n|.)+',
    responseTemplates: InternalServerErrorResponseTemplate
};

export const RESPONSE_500_SERVER_ERROR_CORS = Object.assign({}, RESPONSE_500_SERVER_ERROR, CORS_INTEGRATION_RESPONSE);

export function methodJsonResponse(status: string, model: any) {
    return  {
        statusCode: status,
        responseModels: createResponses(APPLICATION_JSON, model)
    };
}

export function methodXmlResponse(status: string, model: any) {
    return  {
        statusCode: status,
        responseModels: createResponses(APPLICATION_XML, model)
    };
}

export function corsHeaders(methodResponse: MethodResponse): MethodResponse {
    return Object.assign({}, methodResponse, {
        responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
        }
    });
}

export function corsMethodJsonResponse(status: string, model: any): MethodResponse {
    return corsHeaders(methodJsonResponse(status, model));
}

interface IntegrationOptions {
    requestParameters?: {[dest: string]: string}
    requestTemplates?: {[contentType: string]: string}
    cors?: boolean
}

export function defaultIntegration(
    lambdaFunction: Function,
    options?: IntegrationOptions
): LambdaIntegration {
    return new LambdaIntegration(lambdaFunction, {
        proxy: false,
        integrationResponses: [
            options?.cors ? RESPONSE_200_OK_CORS : RESPONSE_200_OK,
            options?.cors ? RESPONSE_500_SERVER_ERROR_CORS :  RESPONSE_500_SERVER_ERROR
        ],
        requestParameters: options?.requestParameters || {},
        requestTemplates: options?.requestTemplates || {}
    });
}

export function defaultSingleResourceIntegration(
    lambdaFunction: Function,
    options?: IntegrationOptions
): LambdaIntegration {
    return new LambdaIntegration(lambdaFunction, {
        proxy: false,
        integrationResponses: [
            options?.cors ? RESPONSE_200_OK_CORS : RESPONSE_200_OK,
            options?.cors ? RESPONSE_404_NOT_FOUND_CORS : RESPONSE_404_NOT_FOUND,
            options?.cors ? RESPONSE_500_SERVER_ERROR_CORS :  RESPONSE_500_SERVER_ERROR
        ],
        requestParameters: options?.requestParameters || {},
        requestTemplates: options?.requestTemplates || {}
    });
}

export function defaultXmlIntegration(lambdaFunction: Function): LambdaIntegration {
    return new LambdaIntegration(lambdaFunction, {
        proxy: false,
        integrationResponses: [
            RESPONSE_200_OK_XML,
            RESPONSE_500_SERVER_ERROR
        ]
    });
}