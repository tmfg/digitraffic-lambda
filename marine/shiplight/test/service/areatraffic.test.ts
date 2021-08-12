import {needToBrighten} from "../../lib/service/areatraffic";
import {DbAreaTraffic} from "../../lib/db/areatraffic";

describe('db-areatraffic', () => {
    test('needToBrighten - never sent', async () => {
        const area = createArea(1, 10);

        expect(needToBrighten(area)).toBeTruthy();
    });

    test('needToBrighten - ends in 1 hour', async () => {
        const sent = new Date();
        const end = new Date();
        end.setHours(end.getHours() + 1);
        const area = createArea(1, 10, sent, end);

        expect(needToBrighten(area)).toBeFalsy();
    });

    test('needToBrighten - ended hour ago', async () => {
        const sent = new Date();
        const end = new Date();
        end.setHours(end.getHours() - 1);
        const area = createArea(1, 10, sent, end);

        expect(needToBrighten(area)).toBeTruthy();
    });

    test('needToBrighten - ends in 30 seconds', async () => {
        const sent = new Date();
        const end = new Date();
        end.setSeconds(end.getSeconds() + 30);
        const area = createArea(1, 10, sent, end);

        expect(needToBrighten(area)).toBeTruthy();
    });

    function createArea(id: number, brighten_duration_min: number, brighten_sent?: Date, brighten_end?: Date): DbAreaTraffic {
        return {
            id,
            name: id.toString(),
            brighten_duration_min,
            brighten_sent,
            brighten_end
        };
    }
});