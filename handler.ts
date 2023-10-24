import { ScheduledEvent } from 'aws-lambda';
import { checkCourts, findTodaysAvailableSlots } from './tennisCourts';

export async function scheduledFunction(event: ScheduledEvent) {
  try {
    console.log('Scheduled event:', JSON.stringify(event, null, 2));
    const type = event['parameter'];

    await checkCourts(type);
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
    const type = event['parameter'];
    await findTodaysAvailableSlots(type);

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