import { APIGatewayEvent, Context } from 'aws-lambda';
import axios from 'axios';

export async function hello(event: APIGatewayEvent, context: Context) {
  try {
    const response = await axios.get('https://jsonplaceholder.typicode.com/todos/1');
    console.log(response.data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Request was successful!',
        data: response.data,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'An error occurred!',
      }),
    };
  }
}
