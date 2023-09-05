import { loginUser } from "./cognito_backend";
import {
    APIGatewayAuthorizerResult,
    AuthResponse,
    Callback,
    Context,
    PolicyDocument,
    Statement
} from "aws-lambda";
import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewayRequestAuthorizerEventHeaders
} from "aws-lambda/trigger/api-gateway-authorizer";
import { CognitoUserSession } from "amazon-cognito-identity-js";
import { logger } from "@digitraffic/common/dist/aws/runtime/dt-logger-default";

const EFFECT_ALLOW = "Allow";
const EFFECT_DENY = "Deny";

const KEY_COGNITO_GROUPS = "cognito:groups";

export const handler: (
    event: APIGatewayRequestAuthorizerEvent,
    context: Context,
    callback: Callback<APIGatewayAuthorizerResult>
) => Promise<void> = async function (
    event: APIGatewayRequestAuthorizerEvent,
    context: Context,
    callback: Callback<APIGatewayAuthorizerResult>
) {
    const result = parseAuthentication(event.headers);

    if (!result) {
        callback("Unauthorized");
    } else {
        const group = getGroupFromPath(event.path);
        const policy = await generatePolicy(group, result[0], result[1], event.methodArn);

        logger.debug(policy);

        callback(null, policy);
    }
};

function parseAuthentication(
    headers: APIGatewayRequestAuthorizerEventHeaders | null
): [string, string] | undefined {
    if (!headers?.authorization) {
        return undefined;
    } else {
        const encodedCreds = headers.authorization.split(" ")[1];
        const plainCreds = Buffer.from(encodedCreds, "base64").toString().split(":");

        return [plainCreds[0], plainCreds[1]];
    }
}

function getGroupFromPath(path: string): string {
    return path.split("/")[2]; // images/[group]/[image]
}

async function generatePolicy(
    group: string,
    username: string,
    password: string,
    methodArn: string
): Promise<AuthResponse> {
    const user = await loginUser(username, password);
    const effect = checkAuthorization(user, group);

    const statementOne: Statement = {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: methodArn
    };

    const policyDocument: PolicyDocument = {
        Version: "2012-10-17",
        Statement: [statementOne]
    };

    const context = {
        groups: JSON.stringify(user ? user.getAccessToken().payload[KEY_COGNITO_GROUPS] : [])
    };

    return {
        principalId: "user",
        policyDocument,
        context
    } as AuthResponse;
}

function checkAuthorization(user: CognitoUserSession | undefined, group: string): string {
    if (user) {
        const userGroups = user.getAccessToken().payload[KEY_COGNITO_GROUPS] as string[] | null;

        if (group === "metadata" || userGroups?.includes(group)) {
            return EFFECT_ALLOW;
        }
    }

    return EFFECT_DENY;
}
