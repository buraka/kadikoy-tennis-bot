import axios from "axios";
import { COURT_TYPE } from "./constants";
import court from "./models/court";
import { sendTelegramMessage } from "./telegram";
import moment from "moment";
import { AVAILABLE_HOUR_DATE_FORMAT, DATE_FORMAT, OLLEYY_DATE_FORMAT } from "./utils";

export const getAvailableHours = async () => {
    // https://www.olleyy.com/api/Saha/Saatler/1204?tarih=10.11.2023
    moment.locale('tr');

    const pitchList: any[] = await court.find({ type: COURT_TYPE.OLLEYY_FOOTBALL });
    const startDate = new Date();
    let msg: string = '';
    for (const currentPitch of pitchList) {
        const availableSlots: string[] = [];
        for (let i = 0; i < 14; i++) { // Loop through 14 days
            const currentDate = moment(startDate).add(i, 'days');
            const date = currentDate.format(OLLEYY_DATE_FORMAT);
            console.log("🚀 ~ file: olleyyPitch.ts:18 ~ getAvailableHours ~ formattedDate:", date)

            const res = await axios({
                method: 'get',
                url: `${currentPitch.url}${date}`
            });
            const availableSlotsByDate = res.data.filter((item: any) => item.UygunSaatId !== null).map((item: any) => `${currentDate.hour(item.Saat).minute(0).format(AVAILABLE_HOUR_DATE_FORMAT)}`);
            console.log("🚀 ~ file: olleyyPitch.ts:24 ~ getAvailableHours ~ availableSlotsByDate:", availableSlotsByDate)

            if (availableSlotsByDate.length > 0) {
                availableSlots.push(...availableSlotsByDate);
                // send telegram messages
                const newSlots = availableSlotsByDate.filter((slotDate: any) => currentPitch.availableSlots.filter((slot: any) => slot.date === slotDate).length === 0)
                console.log("🚀 ~ file: olleyyPitch.ts:32 ~ getAvailableHours ~ newSlots:", newSlots)

                if (newSlots.length > 0) {
                    msg += `\n\nYeni Olleyy Saha\nSaha: ${currentPitch.name} \n`;
                    for (const slot of availableSlotsByDate) {
                        msg += `Zaman: ${currentDate.hour(slot).minute(0).format(DATE_FORMAT)}\n`
                    }
                    console.log("🚀 ~ file: olleyyPitch.ts:37 ~ getAvailableHours ~ msg:", msg)
                }
            }

        }
        await sendTelegramMessage(msg, COURT_TYPE.OLLEYY_FOOTBALL);

        console.log("🚀 ~ file: olleyyPitch.ts:28 ~ getAvailableHours ~ availableSlots:", availableSlots)
        // save hours
        // if (availableHours.length > 0)
        const slotDateList = currentPitch.availableSlots.map((slot: any) => slot.date)
        if (slotDateList.join(' - ') !== availableSlots.join(' - ')) {
            // update slots
            currentPitch.availableSlots = availableSlots.map((slot: string) => ({
                date: slot
            }));
            await currentPitch.save();
        }
    }


}