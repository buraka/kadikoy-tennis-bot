import { ScheduledEvent } from 'aws-lambda';
import { checkCourts } from './tennisCourts';

export async function scheduledFunction(event: ScheduledEvent) {
  console.log('Scheduled event:', JSON.stringify(event, null, 2));

  await checkCourts();

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Function executed successfully!',
    }),
  };
}

// @ts-ignore
// scheduledFunction();