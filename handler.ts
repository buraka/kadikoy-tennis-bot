import { ScheduledEvent } from 'aws-lambda';
import { checkCourts, findTodaysAvailableSlots } from './tennisCourts';

export async function scheduledFunction(event: ScheduledEvent) {
  console.log('Scheduled event:', JSON.stringify(event, null, 2));

  await checkCourts();
}

export async function morningFunction(event: ScheduledEvent) {
  console.log('Scheduled event:', JSON.stringify(event, null, 2));

  await findTodaysAvailableSlots();
}



// @ts-ignore
// morningFunction();