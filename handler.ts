import { ScheduledEvent } from 'aws-lambda';
import { checkCourts, findTodaysAvailableSlots } from './tennisCourts';
import { COURT_TYPE } from './constants';
import connect from './db'
import { closeBot, connectBot } from './telegram';
import { sleep } from './utils';

export async function scheduledFunction(event: ScheduledEvent) {
  try {
    console.log('Scheduled event:', JSON.stringify(event, null, 2));
    connect({ db: process.env.SCRIPTS_DB_URL });
    connectBot();
    const types = Object.keys(COURT_TYPE);
    for (const type of types) {
      console.log("🚀 ~ file: handler.ts:13 ~ scheduledFunction ~ type:", type)
      await checkCourts(type);
      await sleep(1000);
    }
    closeBot();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'done!',
      }),
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function morningFunction(event: ScheduledEvent) {
  try {
    console.log('Scheduled event:', JSON.stringify(event, null, 2));
    connect({ db: process.env.SCRIPTS_DB_URL });
    connectBot();
    const types = Object.keys(COURT_TYPE);
    for (const type of types) {
      console.log("🚀 ~ file: handler.ts:34 ~ morningFunction ~ type:", type)
      await findTodaysAvailableSlots(type);
      await sleep(1000);
    }
    closeBot();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'done!',
      }),
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// @ts-ignore
// scheduledFunction();
// morningFunction();