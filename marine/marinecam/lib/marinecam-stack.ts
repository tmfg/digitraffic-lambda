import {Construct} from '@aws-cdk/core';
import {MobileServerProps} from './app-props';
import * as InternalLambas from './internal-lambdas';
import * as PublicApi from './public-api';
import {BlockPublicAccess, Bucket} from "@aws-cdk/aws-s3";
import {UserPool, UserPoolClient} from "@aws-cdk/aws-cognito";
import {DigitrafficStack} from "digitraffic-common/stack/stack";

export class MarinecamStack extends DigitrafficStack {
    constructor(scope: Construct, id: string, configuration: MobileServerProps) {
        super(scope, id, configuration);

        const bucket = createImageBucket(this, configuration);
        const [userPool, userPoolClient] = createUserPool(this);

        InternalLambas.create(this, bucket);
        PublicApi.create(this, bucket, userPool, userPoolClient);
    }
}

function createUserPool(stack: Construct): [UserPool, UserPoolClient] {
    const userPool = new UserPool(stack, 'UserPool', {
        userPoolName: 'MarinecamUserPool'
    });

    const userPoolClient = new UserPoolClient(stack, 'UserPoolClient', {
        userPool,
        authFlows: {
            userPassword: true,
            userSrp: true
        },
        disableOAuth: true
    });

    return [userPool, userPoolClient];
}

function createImageBucket(stack: Construct, props: MobileServerProps): Bucket {
    return new Bucket(stack, 'MarinecamBucket', {
        bucketName: `dt-marinecam-${props.production ? 'prod' : 'test'}`,
        versioned: false,
        publicReadAccess: false,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });
}
