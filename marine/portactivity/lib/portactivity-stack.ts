import {Construct} from '@aws-cdk/core';
import * as InternalLambdas from './internal-lambdas';
import * as IntegrationApi from './integration-api';
import * as Sqs from './sqs';
import {PublicApi} from "./public-api";
import {Props} from './app-props';
import {Bucket} from "@aws-cdk/aws-s3";
import {DatabaseCluster, DatabaseClusterEngine, DatabaseProxy, ProxyTarget} from "@aws-cdk/aws-rds";
import {ISecret, Secret} from "@aws-cdk/aws-secretsmanager";
import {Canaries} from "./canaries";
import {DigitrafficStack} from "../../../digitraffic-common/stack/stack";

export class PortActivityStack extends DigitrafficStack {
    constructor(scope: Construct, id: string, appProps: Props) {
        super(scope, id, appProps);

        const secret = Secret.fromSecretNameV2(this, 'PortActivitySecret', appProps.secretId);

        this.createRdsProxy(secret, appProps);

        const queueAndDLQ = Sqs.createQueue(this);
        const dlqBucket = new Bucket(this, 'DLQBucket', {
            bucketName: appProps.dlqBucketName
        });

        InternalLambdas.create(queueAndDLQ, dlqBucket, secret, this);
        IntegrationApi.create(queueAndDLQ.queue, this);

        const publicApi = new PublicApi(this, secret);

        new Canaries(this, secret, queueAndDLQ.dlq, publicApi.apiKeyId);

        new Bucket(this, 'DocumentationBucket', {
            bucketName: appProps.documentationBucketName
        });
    }

    createRdsProxy(secret: ISecret, appProps: Props) {
        const cluster = DatabaseCluster.fromDatabaseClusterAttributes(this, 'DbCluster', {
            clusterIdentifier: appProps.dbClusterIdentifier,
            engine: DatabaseClusterEngine.AURORA_POSTGRESQL
        });

        // CDK tries to allow connections between proxy and cluster
        // this does not work on cluster references
        // @ts-ignore
        cluster.connections.allowDefaultPortFrom = () => {};

        const dbProxyName = 'PortActivityRDSProxy';
        new DatabaseProxy(this, dbProxyName, {
            dbProxyName,
            vpc: this.vpc,
            secrets: [secret],
            proxyTarget: ProxyTarget.fromCluster(cluster),
            securityGroups: [this.lambdaDbSg],
            requireTLS: false
        });
    }
}
