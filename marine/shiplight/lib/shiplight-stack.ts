import { Construct } from "constructs";
import * as InternalLambdas from "./internal-lambdas";
import { ShiplightProps } from "./app-props";
import { DigitrafficStack } from "@digitraffic/common/dist/aws/infra/stack/stack";

export class ShiplightStack extends DigitrafficStack {
    constructor(scope: Construct, id: string, appProps: ShiplightProps) {
        super(scope, id, appProps);

        InternalLambdas.create(this);
    }
}
