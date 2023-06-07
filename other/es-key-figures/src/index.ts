import {
    KeyFigureLambdaEvent,
    getApiPaths,
    getKeyFigures,
    getKibanaResults
} from "./lambda/collect-es-key-figures";

export const handler = async (event: KeyFigureLambdaEvent) => {
    const apiPaths = (await getApiPaths()).filter((s) => s.transportType === event.TRANSPORT_TYPE);

    const pathsToProcess = [...apiPaths[0].paths];
    const middleIndex = Math.ceil(pathsToProcess.length / 2);

    const firstHalf = pathsToProcess.splice(0, middleIndex);
    const secondHalf = pathsToProcess.splice(-middleIndex);

    // if (event.PART === 1) {
    //     apiPaths[0].paths = new Set(firstHalf);
    // } else if (event.PART === 2) {
    //     apiPaths[0].paths = new Set(secondHalf);
    // }

    // console.info(
    //     `ES: ${process.env.ES_ENDPOINT}, MySQL: ${
    //         process.env.MYSQL_ENDPOINT
    //     },  Range: ${startDate.toISOString()} -> ${endDate.toISOString()}, Paths: ${apiPaths.map(
    //         (s) => `${s.transportType}, ${Array.from(s.paths).join(", ")}`
    //     )}`
    // );

    const keyFigures = getKeyFigures();

    //console.log(JSON.stringify({ apiPaths, firstHalf, secondHalf }));

    const kibanaResults = await getKibanaResults(keyFigures, apiPaths, event);

    console.log(JSON.stringify(kibanaResults));
    return Promise.resolve(true);
};

handler({ TRANSPORT_TYPE: "road" }).catch((error) =>
    console.error(JSON.stringify({ message: "error", error }))
);
