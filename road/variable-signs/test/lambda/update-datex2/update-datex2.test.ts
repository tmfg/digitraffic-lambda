process.env.SECRET_ID = "SECRET";

import { handler } from "../../../lib/lambda/update-datex2/update-datex2";
import { dbTestBase, setup } from "../../db-testutil";
import { readFileSync } from "fs";
import * as VariableSignsService from "../../../lib/service/variable-signs";
import { ProxyHolder } from "@digitraffic/common/dist/aws/runtime/secrets/proxy-holder";
import { StatusCodeValue } from "../../../lib/model/status-code-value";
import * as sinon from "sinon";

describe(
    "lambda-update-datex2",
    dbTestBase((db) => {
        sinon.stub(ProxyHolder.prototype, "setCredentials").returns(Promise.resolve());

        test("update_valid_datex2", async () => {
            await updateFile("valid_datex2.xml", 200);
            await setup(db);

            const [datex2, lastModified] = await VariableSignsService.findActiveSignsDatex2();

            expect(datex2).toMatch(/xml/);
            expect(datex2).toMatch(/KRM015651/);
            expect(datex2).toMatch(/KRM015511/);
            console.log(lastModified);
        });

        test("update_valid_datex2_without_body", async () => {
            await updateFile("invalid_datex2_without_body.xml", 400);
        });

        test("update_valid_datex2_without_publication", async () => {
            await updateFile("invalid_datex2_without_publication.xml", 400);
        });

        test("insert_update", async () => {
            await updateFile("valid_datex2.xml", 200);
            await setup(db);

            const [oldDatex2, lastModified1] = await VariableSignsService.findActiveSignsDatex2();
            expect(oldDatex2).toMatch(/<overallStartTime>2020-02-19T14:45:02.013Z<\/overallStartTime>/);
            console.log(lastModified1.toISOString());

            // and then update
            await updateFile("valid_datex2_updated.xml", 200);

            const [newDatex2, lastModified2] = await VariableSignsService.findActiveSignsDatex2();
            expect(newDatex2).toMatch(/<overallStartTime>2020-02-20T14:45:02.013Z<\/overallStartTime>/);
            console.log(lastModified2.toISOString());
        });
    })
);

async function updateFile(filename: string, expectedStatusCode: number): Promise<StatusCodeValue> {
    const request = getRequest(filename);
    const response = await handler(request);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
}

function getRequest(filename: string): { body: string } {
    return {
        body: readFileSync("test/lambda/update-datex2/" + filename, "utf8")
    };
}
