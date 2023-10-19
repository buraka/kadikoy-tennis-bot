import axios from 'axios';
import * as moment from "moment";
// import moment from "moment";
import connect from './db'
import court from './models/court';
import { sendTelegramMessage } from './telegram';

const DATE_FORMAT = 'DD MMM dddd HH:mm';

const formatDateForMessaging = (dateStr: string | undefined) => {
    try {
        console.log("🚀 ~ file: tennisCourts.ts:10 ~ formatDateForMessaging ~ dateStr:", dateStr)
        moment.locale('tr');
        const date = moment(dateStr);
        const needPriorty = date.day() === 6 || date.day() === 5 || date.hour() > 18

        return needPriorty ? `${date.format(DATE_FORMAT)} ***` : date.format(DATE_FORMAT);
    } catch (e) {
        console.error('formatDateForMessaging', e);
        return 'hata'
    }
}

const checkCourts = async () => {
    connect({ db: process.env.SCRIPTS_DB_URL });
    const courtList: any[] = await court.find({});
    console.log("🚀 ~ file: tennisCourts.ts:27 ~ checkCourts ~ courtList:", courtList.map(c => c.name))
    for (const currentCourt of courtList) {
        const res = await axios({
            method: 'get',
            url: currentCourt.url
        });
        let { programs } = res.data;
        const nextWeekRes = await axios({
            method: 'get',
            url: `${currentCourt.url}${res.data.nextWeek}`
        });
        Array.prototype.push.apply(programs, nextWeekRes.data.programs);

        let availableSlots = programs.filter((program: any) => program.statu === 1).map((program: any) => program.programDate)

        // check and alert if new slot found
        const newSlots = availableSlots.filter((date: any) => currentCourt.availableSlots.filter((slot: any) => slot.date === date).length === 0)
        console.log("🚀 ~ file: tennisCourts.ts:42 ~ checkCourts ~ newSlots:", newSlots, { courtName: currentCourt.name })
        if (newSlots.length > 0) {
            // Alert new slot found
            let msg = `Yeni Slot\nKort: ${currentCourt.name} \n`;
            for (const slot of newSlots) {
                msg += `Zaman: ${formatDateForMessaging(slot)}\n`
            }
            await sendTelegramMessage(msg);
            console.log("🚀 ~ file: tennisCourts.ts:49 ~ checkCourts ~ msg:", msg)
        }

        // update available slots if necessary
        const slotDateList = currentCourt.availableSlots.map((slot: any) => slot.date)
        if (slotDateList.join(' - ') !== availableSlots.join(' - ')) {
            // update slots
            currentCourt.availableSlots = availableSlots.map((slot: string) => ({
                date: slot
            }));
            await currentCourt.save()
        }

    }
    // return process.exit(0);
}

const findTodaysAvailableSlots = async () => {
    connect({ db: process.env.SCRIPTS_DB_URL });
    const courtList = await court.find({});
    let msg = `Bugunun Uygun Kortlari\n`;
    let sendMessage = false;
    console.log("🚀 ~ file: tennisCourts.ts:74 ~ checkCourts ~ courtList:", courtList.map(c => c.name))

    for (const currentCourt of courtList) {
        const todaysAvailableCourts = currentCourt.availableSlots
            .filter((slot: any) => moment(slot.date).diff(moment(), 'hours') < 24)
            .map((slot: any) => slot.date);
        console.log("🚀 ~ file: tennisCourts.ts:79 ~ findTodaysAvailableSlots ~ todaysAvailableCourts:", todaysAvailableCourts, { name: currentCourt.name })
        if (todaysAvailableCourts.length > 0) {
            sendMessage = true;
            msg += `Kort: ${currentCourt.name} \n`
            for (const slot of todaysAvailableCourts) {
                msg += `Zaman: ${formatDateForMessaging(slot)}\n`
            }
        }
    }
    if (sendMessage) {
        console.log("🚀 ~ file: tennisCourts.ts:88 ~ findTodaysAvailableSlots ~ msg:", msg)
        await sendTelegramMessage(msg);
    }
    // return process.exit(0);
}

export { checkCourts, findTodaysAvailableSlots };